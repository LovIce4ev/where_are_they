"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Loader2, User } from 'lucide-react';
import { getMyMessages, markMessagesAsRead, type Message } from '@/lib/supabase';
// import { formatDistanceToNow } from 'date-fns';
// import { zhCN } from 'date-fns/locale';

function timeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return '刚刚';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}小时前`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}天前`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}个月前`;
    return `${Math.floor(months / 12)}年前`;
}

interface InboxModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function InboxModal({ isOpen, onClose }: InboxModalProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadMessages = async () => {
        try {
            setLoading(true);
            const data = await getMyMessages();
            setMessages(data);

            // 标记已读
            const unreadIds = data.filter(m => !m.is_read).map(m => m.id);
            if (unreadIds.length > 0) {
                await markMessagesAsRead(unreadIds);
                // 触发一个全局事件或者回调来更新外部的未读计数器？
                // 暂时简单处理：下次打开时才会更新
            }
        } catch (err) {
            console.error(err);
            setError('加载消息失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            loadMessages();
        }
    }, [isOpen]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[2000] flex items-center justify-center modal-backdrop"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="bg-[#fdfaf3] rounded-3xl p-6 shadow-2xl border border-[#d4a373]/30 w-[90%] max-w-[500px] h-[80vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-[#4a3e3e]">
                                收件箱 📬
                            </h2>
                            <button
                                onClick={onClose}
                                className="p-1 hover:bg-black/5 rounded-full"
                            >
                                <X size={20} className="text-[#4a3e3e]" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2">
                            {loading ? (
                                <div className="flex items-center justify-center h-full text-[#d4a373]">
                                    <Loader2 className="animate-spin mr-2" /> 加载中...
                                </div>
                            ) : error ? (
                                <div className="flex items-center justify-center h-full text-red-500">
                                    {error}
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-60">
                                    <Mail size={48} className="mb-2" />
                                    <p>暂时没有消息...</p>
                                </div>
                            ) : (
                                messages.map((msg) => (
                                    <motion.div
                                        key={msg.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="bg-white rounded-xl p-4 shadow-sm border border-[#d4a373]/20 relative group"
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden flex-shrink-0 mt-1 border border-gray-200">
                                                {msg.sender?.avatar_url ? (
                                                    <img src={msg.sender.avatar_url} alt={msg.sender.username} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                        <User size={20} />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-baseline mb-1">
                                                    <h3 className="font-bold text-[#4a3e3e] text-sm">
                                                        {msg.sender?.username || '未知用户'}
                                                    </h3>
                                                    <span className="text-xs text-gray-400">
                                                        {timeAgo(msg.created_at)}
                                                    </span>
                                                </div>
                                                <p className="text-[#4a3e3e] text-sm leading-relaxed whitespace-pre-wrap break-words">
                                                    {msg.content}
                                                </p>
                                            </div>
                                        </div>

                                        {!msg.is_read && (
                                            <div className="absolute top-4 right-4 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                        )}
                                    </motion.div>
                                ))
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
