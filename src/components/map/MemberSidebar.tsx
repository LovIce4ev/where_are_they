"use client";

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MapPin, X, ChevronRight, User } from 'lucide-react';
import type { Profile } from '@/lib/supabase';

// 复用 MapMember 类型或重新定义
interface Member {
    id: string;
    userId: string;
    name: string;
    city: string;
    latlng: [number, number];
    status: string;
    countdown: string;
    avatar: string;
}

interface MemberSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    members: Member[];
    onSelectMember: (member: Member) => void;
    currentUserId?: string;
}

export default function MemberSidebar({ isOpen, onClose, members, onSelectMember, currentUserId }: MemberSidebarProps) {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredMembers = useMemo(() => {
        if (!searchQuery) return members;
        const lowerQuery = searchQuery.toLowerCase();
        return members.filter(m =>
            m.name.toLowerCase().includes(lowerQuery) ||
            m.city.toLowerCase().includes(lowerQuery)
        );
    }, [members, searchQuery]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop for mobile */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 sidebar-backdrop z-[1500] md:hidden"
                    />

                    {/* Sidebar */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed top-0 right-0 h-full w-[80%] max-w-[320px] sidebar-panel shadow-2xl z-[1600] border-l border-[#d4a373]/30 flex flex-col"
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-[#d4a373]/20 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-[#4a3e3e] flex items-center gap-2">
                                成员列表 <span className="text-sm font-normal text-[#d4a373] bg-[#d4a373]/10 px-2 py-0.5 rounded-full">{members.length}</span>
                            </h2>
                            <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full text-[#4a3e3e]">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Search */}
                        <div className="p-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#d4a373]" size={16} />
                                <input
                                    type="text"
                                    placeholder="搜索名字或城市..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-white border border-[#d4a373]/30 rounded-xl text-sm text-[#4a3e3e] focus:outline-none focus:border-[#d4a373] placeholder-gray-400"
                                />
                            </div>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                            {filteredMembers.length === 0 ? (
                                <div className="text-center text-gray-400 py-8 text-sm">
                                    没有找到匹配的成员
                                </div>
                            ) : (
                                filteredMembers.map(member => (
                                    <button
                                        key={member.id}
                                        onClick={() => {
                                            onSelectMember(member);
                                            if (window.innerWidth < 768) onClose(); // 移动端选择后关闭侧边栏
                                        }}
                                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/80 hover:shadow-sm border border-transparent hover:border-[#d4a373]/20 transition-all text-left group"
                                    >
                                        <div className="relative w-10 h-10 flex-shrink-0">
                                            <img
                                                src={member.avatar}
                                                alt={member.name}
                                                className={`w-full h-full rounded-full object-cover border-2 ${member.userId === currentUserId ? 'border-orange-400' : 'border-white'} shadow-sm`}
                                            />
                                            {member.userId === currentUserId && (
                                                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-orange-500 rounded-full border border-white" />
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <h3 className={`font-bold text-sm truncate ${member.userId === currentUserId ? 'text-orange-600' : 'text-[#4a3e3e]'}`}>
                                                    {member.name} {member.userId === currentUserId && '(你)'}
                                                </h3>
                                            </div>
                                            <div className="flex items-center gap-1 text-xs text-[#d4a373] truncate">
                                                <MapPin size={10} />
                                                <span>{member.city}</span>
                                            </div>
                                        </div>

                                        <ChevronRight size={16} className="text-[#d4a373] opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </button>
                                ))
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
