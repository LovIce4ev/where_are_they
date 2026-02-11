import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
    id: string;
    user_id: string; // 关联 Supabase Auth 用户
    username: string;
    avatar_url: string;
    current_city: string;
    lat: number;
    lng: number;
    status_text: string;
    return_date: string; // 支持模糊时间或 ISO 字符串
};

export type Message = {
    id: string;
    sender_id: string;
    receiver_id: string;
    content: string;
    is_read: boolean;
    created_at: string;
    sender?: { // 关联查询带出的发送者信息
        username: string;
        avatar_url: string;
    };
};

/**
 * 从数据库获取所有用户 profile
 * @returns Profile 数组，按创建时间排序
 */
export async function getProfiles(): Promise<Profile[]> {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching profiles:', error);
        return [];
    }

    return data || [];
}

/**
 * 创建新的用户 profile
 * 自动绑定当前登录用户的 user_id
 */
export async function createProfile(
    profile: Omit<Profile, 'id' | 'user_id'>
): Promise<{ data: Profile | null; error: Error | null }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: new Error('未登录') };

    const { data, error } = await supabase
        .from('profiles')
        .insert([{ ...profile, user_id: user.id }])
        .select()
        .single();

    return { data, error };
}

/**
 * 获取当前登录用户的 profile
 */
export async function getMyProfile(): Promise<Profile | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

    if (error) {
        // PGRST116 表示没有找到记录，不算错误
        if (error.code !== 'PGRST116') {
            console.error('Error fetching my profile:', error);
        }
        return null;
    }

    return data;
}

/**
 * 更新用户 profile（仅允许更新自己的）
 */
export async function updateProfile(
    id: string,
    updates: Partial<Omit<Profile, 'id' | 'user_id'>>
): Promise<{ error: Error | null }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: new Error('未登录') };

    const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id); // 确保只能更新自己的

    return { error };
}

/**
 * 删除用户 profile（仅允许删除自己的）
 */
export async function deleteProfile(id: string): Promise<{ error: Error | null }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: new Error('未登录') };

    const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id); // 确保只能删除自己的

    return { error };
}

/**
 * 发送留言
 */
export async function sendMessage(receiverId: string, content: string): Promise<{ error: Error | null }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: new Error('未登录') };

    const { error } = await supabase
        .from('messages')
        .insert([{ // key fix: 传入数组或对象均可，但最好保持一致
            sender_id: user.id,
            receiver_id: receiverId,
            content: content
        }]);

    return { error };
}

/**
 * 获取我的收件箱消息 (包含发送者信息)
 */
export async function getMyMessages(): Promise<Message[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // 1. 获取消息
    const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .eq('receiver_id', user.id)
        .order('created_at', { ascending: false });

    if (error || !messages) {
        console.error('Error fetching messages:', error);
        return [];
    }

    if (messages.length === 0) return [];

    // 2. 获取发送者 ID 列表
    const senderIds = [...new Set(messages.map(m => m.sender_id))];

    // 3. 获取发送者资料 (注意：profiles 表要有 user_id 列)
    const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, avatar_url')
        .in('user_id', senderIds);

    const profileMap = new Map();
    if (profiles) {
        profiles.forEach(p => profileMap.set(p.user_id, p));
    }

    // 4. 组装数据
    return messages.map(msg => {
        const sender = profileMap.get(msg.sender_id);
        return {
            ...msg,
            sender: sender ? { username: sender.username, avatar_url: sender.avatar_url } : { username: '未知用户', avatar_url: '' }
        };
    });
}

/**
 * 获取未读消息数
 */
export async function getUnreadCount(): Promise<number> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .eq('is_read', false);

    if (error) return 0;
    return count || 0;
}

/**
 * 标记消息为已读
 */
export async function markMessagesAsRead(messageIds: string[]): Promise<{ error: Error | null }> {
    const { error } = await supabase
        .from('messages')
        .update({ is_read: true })
        .in('id', messageIds);

    return { error };
}
