"use client";

import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Clock, MessageSquare, Edit2, Loader2, LogIn, LogOut, User, Plus, Save, Trash2, Mail, Menu } from 'lucide-react';
import AvatarUpload from './AvatarUpload';
import { supabase, getProfiles, getMyProfile, updateProfile, deleteProfile, getUnreadCount, type Profile } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import LoginModal from '@/components/auth/LoginModal';
import AddProfileModal from './AddProfileModal';
import MessageModal from './MessageModal';
import InboxModal from './InboxModal';
import MemberSidebar from './MemberSidebar';
import MapController from './MapController';

// 修复 Leaflet 默认图标
const DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const CHIANG_MAI: [number, number] = [18.7883, 98.9817];

type MapMember = {
    id: string;
    userId: string;
    name: string;
    city: string;
    latlng: [number, number];
    status: string;
    countdown: string;
    avatar: string;
};

const profileToMember = (profile: Profile): MapMember => ({
    id: profile.id,
    userId: profile.user_id,
    name: profile.username,
    city: profile.current_city || '未知',
    latlng: [profile.lat, profile.lng],
    status: profile.status_text || '',
    countdown: profile.return_date || '待定',
    avatar: profile.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=default',
});

// NOTE: 预创建 homeIcon，避免每次渲染重新生成 SVG + encodeURIComponent
const HOME_SVG = `
    <svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 65 L50 35 L90 65" fill="#e76f51" stroke="#e76f51" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
        <rect x="20" y="65" width="60" height="45" rx="2" fill="#f4a261"/>
        <path d="M42 110 L42 85 A 8 8 0 0 1 58 85 L58 110 Z" fill="#2a9d8f"/>
        <circle cx="50" cy="58" r="6" fill="#fff" stroke="#264653" stroke-width="2"/>
        <path d="M50 15 C40 5 25 15 50 30 C75 15 60 5 50 15 Z" fill="#e63946"/>
    </svg>`;

const HOME_ICON = L.icon({
    iconUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(HOME_SVG)}`,
    iconSize: [60, 72],
    iconAnchor: [30, 36],
    className: 'hover:scale-110 transition-transform duration-500'
});

// NOTE: 预创建成员图标缓存，避免每次渲染都调用 L.divIcon
const memberIconCache = new Map<string, L.DivIcon>();

/**
 * 获取成员地图图标，使用缓存避免重复创建
 * @param avatar 头像 URL
 * @param isOwner 是否为当前用户的 profile
 */
function getMemberIcon(avatar: string, isOwner: boolean): L.DivIcon {
    const cacheKey = `${avatar}_${isOwner}`;
    const cached = memberIconCache.get(cacheKey);
    if (cached) return cached;

    const icon = L.divIcon({
        className: 'custom-member-icon',
        html: `<div class="group relative cursor-pointer">
                 <div class="w-10 h-10 rounded-full border-2 ${isOwner ? 'border-orange-400' : 'border-white'} shadow-lg overflow-hidden bg-white hover:scale-110 transition-transform">
                   <img src="${avatar}" class="w-full h-full object-cover" />
                 </div>
                 <div class="absolute -bottom-1 -right-1 w-3 h-3 ${isOwner ? 'bg-orange-500' : 'bg-green-500'} border-2 border-white rounded-full"></div>
               </div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
    });

    memberIconCache.set(cacheKey, icon);
    return icon;
}

// NOTE: 连线样式对象提取到组件外部，避免每次渲染创建新对象
const POLYLINE_OPTIONS: L.PolylineOptions = {
    color: '#ff7b54',
    weight: 2,
    opacity: 0.6,
    dashArray: '5, 10',
    lineCap: 'round',
    className: 'connection-line'
};

/**
 * 独立 Marker + Polyline 组件，使用 React.memo 避免无关成员变化时重渲染
 */
const MemberMarkerItem = memo(function MemberMarkerItem({
    member,
    isOwner,
    onSelect,
}: {
    member: MapMember;
    isOwner: boolean;
    onSelect: (member: MapMember) => void;
}) {
    const icon = getMemberIcon(member.avatar, isOwner);

    return (
        <>
            <Marker
                position={member.latlng}
                eventHandlers={{
                    click: () => onSelect(member),
                }}
                icon={icon}
            />
            <Polyline
                positions={[member.latlng, CHIANG_MAI]}
                pathOptions={POLYLINE_OPTIONS}
            />
        </>
    );
});

export default function ConnectionMap() {
    const { user, signOut } = useAuth();

    // Data States
    const [members, setMembers] = useState<MapMember[]>([]);
    const [myProfile, setMyProfile] = useState<Profile | null>(null);
    const [unreadCount, setUnreadCount] = useState(0);

    // UI States
    const [selectedMember, setSelectedMember] = useState<MapMember | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [mapTarget, setMapTarget] = useState<[number, number] | null>(null);

    // Modal & Sidebar States
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showMessageModal, setShowMessageModal] = useState(false);
    const [showInboxModal, setShowInboxModal] = useState(false);
    const [showSidebar, setShowSidebar] = useState(false);

    // Edit Form States
    const [editStatus, setEditStatus] = useState('');
    const [editCountdown, setEditCountdown] = useState('');
    const [saving, setSaving] = useState(false);

    // Initial Load
    const loadProfiles = useCallback(async () => {
        try {
            const profiles = await getProfiles();
            setMembers(profiles.map(profileToMember));
        } catch (err) {
            console.error('Failed to load profiles', err);
        }
    }, []);

    const loadMyProfile = useCallback(async () => {
        if (!user) {
            setMyProfile(null);
            return;
        }
        const profile = await getMyProfile();
        setMyProfile(profile);

        const count = await getUnreadCount();
        setUnreadCount(count);
    }, [user]);

    useEffect(() => {
        loadProfiles();
    }, [loadProfiles]);

    useEffect(() => {
        loadMyProfile();
    }, [loadMyProfile]);

    // Realtime Subscriptions
    useEffect(() => {
        const profileChannel = supabase
            .channel('public:profiles')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
                loadProfiles();
            })
            .subscribe();

        let messageChannel: ReturnType<typeof supabase.channel> | undefined;
        if (user) {
            messageChannel = supabase
                .channel(`public:messages:${user.id}`)
                .on('postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'messages',
                        filter: `receiver_id=eq.${user.id}`
                    },
                    () => {
                        setUnreadCount(prev => prev + 1);
                    }
                )
                .subscribe();
        }

        return () => {
            supabase.removeChannel(profileChannel);
            if (messageChannel) supabase.removeChannel(messageChannel);
        };
    }, [user, loadProfiles]);

    const isMyProfile = useCallback((member: MapMember) => !!user && member.userId === user.id, [user]);

    // NOTE: 稳定回调引用，传递给 memo 子组件
    const handleSelectMember = useCallback((member: MapMember) => {
        setSelectedMember(member);
        setIsEditing(false);
    }, []);

    // Actions
    const handleAvatarUpdate = async (newUrl: string) => {
        if (!selectedMember) return;

        const updatedMembers = members.map(m =>
            m.id === selectedMember.id ? { ...m, avatar: newUrl } : m
        );
        setMembers(updatedMembers);
        setSelectedMember({ ...selectedMember, avatar: newUrl });

        // NOTE: 头像更新后清理对应缓存
        memberIconCache.delete(`${selectedMember.avatar}_true`);
        memberIconCache.delete(`${selectedMember.avatar}_false`);

        await supabase.from('profiles').update({ avatar_url: newUrl }).eq('id', selectedMember.id);
        setIsEditing(false);
    };

    const handleSaveProfile = async () => {
        if (!selectedMember) return;
        setSaving(true);
        try {
            const { error } = await updateProfile(selectedMember.id, {
                status_text: editStatus,
                return_date: editCountdown,
            });
            if (error) throw error;

            const updated = { ...selectedMember, status: editStatus, countdown: editCountdown };
            setMembers(prev => prev.map(m => m.id === selectedMember.id ? updated : m));
            setSelectedMember(updated);
            setIsEditing(false);
        } catch (err: any) {
            alert(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteProfile = async () => {
        if (!selectedMember || !window.confirm('确定要删除你的位置吗？')) return;
        try {
            await deleteProfile(selectedMember.id);
            setMembers(prev => prev.filter(m => m.id !== selectedMember.id));
            setSelectedMember(null);
            setMyProfile(null);
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleFlyToMember = useCallback((member: MapMember) => {
        setMapTarget(member.latlng);
        setTimeout(() => {
            setSelectedMember(member);
        }, 1500);
    }, []);

    // NOTE: 缓存 mapBounds 对象，避免每次渲染创建新的引用
    const mapBounds = useMemo<L.LatLngBoundsExpression>(() => [[-60, -180], [85, 180]], []);

    return (
        <div className="relative w-full h-screen overflow-hidden">
            {/* Map — 移除 sepia/saturate/contrast filter，减少全屏 GPU 合成开销 */}
            <div className="absolute inset-0 z-0">
                <MapContainer
                    center={CHIANG_MAI}
                    zoom={4}
                    minZoom={1}
                    maxBounds={mapBounds}
                    maxBoundsViscosity={1.0}
                    className="w-full h-full"
                    style={{ background: '#fdfaf3' }}
                >
                    <TileLayer
                        attribution='&copy; OpenStreetMap contributors'
                        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png"
                        noWrap={true}
                    />

                    <MapController target={mapTarget} />

                    <Marker position={CHIANG_MAI} icon={HOME_ICON}>
                        <Popup><div className="font-bold">清迈家中心 🏡</div></Popup>
                    </Marker>

                    {members.map(member => (
                        <MemberMarkerItem
                            key={member.id}
                            member={member}
                            isOwner={!!user && member.userId === user.id}
                            onSelect={handleSelectMember}
                        />
                    ))}
                </MapContainer>
            </div>

            {/* NOTE: paper-texture 层已移除，减少 1 个全屏 GPU 合成层 */}

            {/* Title */}
            <motion.div
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="absolute top-8 left-1/2 -translate-x-1/2 z-10 text-center pointer-events-none w-full px-4"
            >
                <h1 className="text-2xl md:text-4xl font-serif tracking-[0.2em] text-[#4a3e3e] drop-shadow-sm">
                    CMI活点地图！
                </h1>
                <div className="flex items-center justify-center gap-4 mt-2">
                    <div className="h-[1px] w-8 md:w-12 bg-[#d4a373]"></div>
                    <p className="text-xs md:text-sm text-[#d4a373] italic font-light">Where hearts find their way home</p>
                    <div className="h-[1px] w-8 md:w-12 bg-[#d4a373]"></div>
                </div>
            </motion.div>

            {/* User Controls (Top Right) */}
            <div className="absolute top-6 right-6 z-10 flex flex-col items-end gap-3">
                {user ? (
                    <>
                        {/* User Pill — 使用 glass-card class 替代内联 backdrop-blur */}
                        <div className="glass-card px-4 py-2 rounded-full border border-[#d4a373]/30 flex items-center gap-2 shadow-sm">
                            <User size={16} className="text-[#d4a373]" />
                            <span className="text-sm text-[#4a3e3e] font-medium max-w-[100px] truncate">
                                {user.user_metadata?.username || user.email?.split('@')[0]}
                            </span>
                            <button
                                onClick={() => signOut()}
                                className="ml-2 hover:bg-black/5 p-1 rounded-full transition-colors"
                            >
                                <LogOut size={14} className="text-[#4a3e3e]/60" />
                            </button>
                        </div>

                        {/* Inbox Button */}
                        <button
                            onClick={() => {
                                setShowInboxModal(true);
                                setUnreadCount(0);
                            }}
                            className="glass-card p-3 rounded-full border border-[#d4a373]/30 hover:bg-white transition-colors relative shadow-sm group"
                            title="收件箱"
                        >
                            <Mail size={20} className="text-[#4a3e3e] group-hover:scale-110 transition-transform" />
                            {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-white">
                                    {unreadCount}
                                </span>
                            )}
                        </button>

                        {/* Sidebar Toggle */}
                        <button
                            onClick={() => setShowSidebar(true)}
                            className="glass-card p-3 rounded-full border border-[#d4a373]/30 hover:bg-white transition-colors shadow-sm md:hidden"
                        >
                            <Menu size={20} className="text-[#4a3e3e]" />
                        </button>
                    </>
                ) : (
                    <button
                        onClick={() => setShowLoginModal(true)}
                        className="glass-card px-5 py-2.5 rounded-full border border-[#d4a373]/30 hover:bg-white transition-colors flex items-center gap-2 shadow-sm"
                    >
                        <LogIn size={18} className="text-[#d4a373]" />
                        <span className="text-sm text-[#4a3e3e] font-medium">登录</span>
                    </button>
                )}
            </div>

            {/* Sidebar (Desktop: Left | Mobile: Drawer) */}
            <div className="hidden md:block absolute top-[120px] right-6 z-10">
                <button
                    onClick={() => setShowSidebar(true)}
                    className="glass-card p-3 rounded-full border border-[#d4a373]/30 hover:bg-white transition-colors shadow-sm flex items-center gap-2"
                >
                    <Menu size={20} className="text-[#4a3e3e]" />
                    <span className="text-sm font-medium text-[#4a3e3e]">成员列表</span>
                </button>
            </div>

            <MemberSidebar
                isOpen={showSidebar}
                onClose={() => setShowSidebar(false)}
                members={members}
                onSelectMember={handleFlyToMember}
                currentUserId={user?.id}
            />

            {/* Profile Card Modal */}
            <AnimatePresence>
                {selectedMember && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000] w-[90%] max-w-[320px]"
                    >
                        <div className="bg-[#fdfaf3] rounded-3xl p-6 shadow-2xl border border-[#d4a373]/30 relative">
                            <button
                                onClick={() => {
                                    setSelectedMember(null);
                                    setIsEditing(false);
                                }}
                                className="absolute top-4 right-4 p-1 hover:bg-black/5 rounded-full"
                            >
                                <X size={20} className="text-[#4a3e3e]" />
                            </button>

                            <div className="flex flex-col items-center">
                                {/* Avatar */}
                                <div className="relative mb-4">
                                    {isEditing && isMyProfile(selectedMember) ? (
                                        <AvatarUpload
                                            userId={selectedMember.id}
                                            currentAvatarUrl={selectedMember.avatar}
                                            onUploadComplete={handleAvatarUpdate}
                                        />
                                    ) : (
                                        <div className="w-20 h-20 rounded-full border-4 border-white shadow-lg overflow-hidden bg-white">
                                            <img src={selectedMember.avatar} alt={selectedMember.name} className="w-full h-full object-cover" />
                                        </div>
                                    )}

                                    {!isEditing && isMyProfile(selectedMember) && (
                                        <button
                                            onClick={() => {
                                                setEditStatus(selectedMember.status);
                                                setEditCountdown(selectedMember.countdown);
                                                setIsEditing(true);
                                            }}
                                            className="absolute -bottom-1 -right-1 p-1.5 bg-[#4a3e3e] text-white rounded-full border-2 border-white shadow-md hover:scale-110 transition-transform"
                                        >
                                            <Edit2 size={12} />
                                        </button>
                                    )}
                                </div>

                                <h2 className="text-2xl font-bold text-[#4a3e3e]">{selectedMember.name}</h2>
                                <div className="flex items-center gap-1 text-[#d4a373] text-sm mt-1">
                                    <MapPin size={14} />
                                    <span>{selectedMember.city}</span>
                                </div>

                                {isMyProfile(selectedMember) && (
                                    <div className="mt-2 text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">
                                        It's You!
                                    </div>
                                )}

                                <div className="w-full h-[1px] bg-[#d4a373]/20 my-5" />

                                {isEditing && isMyProfile(selectedMember) ? (
                                    // Edit Form
                                    <div className="w-full space-y-4">
                                        <div className="space-y-1">
                                            <label className="text-xs text-gray-400">近况</label>
                                            <textarea
                                                value={editStatus}
                                                onChange={(e) => setEditStatus(e.target.value)}
                                                className="w-full px-3 py-2 bg-white border border-[#d4a373]/30 rounded-xl text-sm"
                                                rows={2}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs text-gray-400">回家倒计时</label>
                                            <input
                                                type="text"
                                                value={editCountdown}
                                                onChange={(e) => setEditCountdown(e.target.value)}
                                                className="w-full px-3 py-2 bg-white border border-[#d4a373]/30 rounded-xl text-sm"
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleSaveProfile}
                                                disabled={saving}
                                                className="flex-1 bg-[#4a3e3e] text-white py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                                            >
                                                {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} 保存
                                            </button>
                                            <button
                                                onClick={() => setIsEditing(false)}
                                                className="px-3 border border-[#d4a373]/30 rounded-xl text-sm text-[#4a3e3e]"
                                            >
                                                取消
                                            </button>
                                        </div>
                                        <button
                                            onClick={handleDeleteProfile}
                                            className="w-full text-red-400 text-xs py-1 flex items-center justify-center gap-1"
                                        >
                                            <Trash2 size={12} /> 删除我的位置
                                        </button>
                                    </div>
                                ) : (
                                    // View Mode
                                    <div className="w-full space-y-4 text-left">
                                        <div className="flex items-start gap-3">
                                            <Clock size={18} className="text-orange-500 mt-0.5" />
                                            <div>
                                                <p className="text-xs text-gray-400">回家倒计时</p>
                                                <p className="text-lg font-serif italic text-orange-600 font-bold">{selectedMember.countdown}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-3">
                                            <MessageSquare size={18} className="text-[#d4a373] mt-0.5" />
                                            <div>
                                                <p className="text-xs text-gray-400">近况</p>
                                                <p className="text-sm text-[#4a3e3e] leading-relaxed italic">
                                                    {selectedMember.status ? `"${selectedMember.status}"` : '暂无近况'}
                                                </p>
                                            </div>
                                        </div>

                                        {!isMyProfile(selectedMember) && (
                                            <button
                                                onClick={() => {
                                                    if (!user) {
                                                        alert('请先登录才能留言');
                                                        setShowLoginModal(true);
                                                        return;
                                                    }
                                                    setShowMessageModal(true);
                                                }}
                                                className="w-full mt-6 py-3 bg-[#4a3e3e] text-[#fdfaf3] rounded-xl font-bold hover:bg-[#5a4e4e] transition-colors flex items-center justify-center gap-2"
                                            >
                                                <Mail size={18} /> 给 TA 留言
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* NOTE: 条件渲染模态框 — 只在需要时挂载，减少 DOM 占用和事件监听 */}
            {showLoginModal && (
                <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
            )}

            {showAddModal && (
                <AddProfileModal
                    isOpen={showAddModal}
                    onClose={() => setShowAddModal(false)}
                    onSuccess={() => {
                        loadProfiles();
                        loadMyProfile();
                    }}
                />
            )}

            {showMessageModal && selectedMember && (
                <MessageModal
                    isOpen={showMessageModal}
                    onClose={() => setShowMessageModal(false)}
                    receiverId={selectedMember.userId}
                    receiverName={selectedMember.name}
                />
            )}

            {showInboxModal && (
                <InboxModal isOpen={showInboxModal} onClose={() => setShowInboxModal(false)} />
            )}

            {/* Fab Buttons */}
            {user && !myProfile && (
                <button
                    onClick={() => setShowAddModal(true)}
                    className="absolute bottom-10 right-8 z-10 bg-[#4a3e3e] text-white px-5 py-3 rounded-full shadow-lg hover:bg-[#5a4e4e] transition-colors flex items-center gap-2 animate-bounce"
                >
                    <Plus size={20} />
                    <span className="font-medium">加入地图</span>
                </button>
            )}

            {/* Mobile Footer Stats */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 md:hidden pointer-events-none">
                <div className="glass-card px-4 py-1.5 rounded-full border border-white/50 text-xs text-[#4a3e3e]/80 font-medium">
                    {members.length} 人连接中
                </div>
            </div>
        </div>
    );
}
