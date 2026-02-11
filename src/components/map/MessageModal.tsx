"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Loader2 } from 'lucide-react';
import { sendMessage } from '@/lib/supabase';

interface MessageModalProps {
    isOpen: boolean;
    onClose: () => void;
    receiverId: string;
    receiverName: string;
}

export default function MessageModal({ isOpen, onClose, receiverId, receiverName }: MessageModalProps) {
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim()) return;

        setLoading(true);
        setError(null);

        try {
            const { error } = await sendMessage(receiverId, content);
            if (error) throw error;

            setSuccess(true);
            setTimeout(() => {
                onClose();
                setSuccess(false);
                setContent('');
            }, 1500);
        } catch (err: any) {
            setError(err.message || '发送失败，请重试');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="bg-[#fdfaf3] rounded-3xl p-6 shadow-2xl border border-[#d4a373]/30 w-[90%] max-w-[400px]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 p-1 hover:bg-black/5 rounded-full"
                        >
                            <X size={20} className="text-[#4a3e3e]" />
                        </button>

                        <h2 className="text-xl font-bold text-[#4a3e3e] mb-1">
                            给 {receiverName} 留言
                        </h2>
                        <p className="text-xs text-[#d4a373] mb-4">
                            告诉 TA 你也在思念清迈...
                        </p>

                        {success ? (
                            <div className="py-8 text-center text-green-600">
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="text-4xl mb-2"
                                >
                                    ✨
                                </motion.div>
                                <p>消息已发送！</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <textarea
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    placeholder="写下你想说的话..."
                                    rows={4}
                                    className="w-full px-4 py-3 bg-white border border-[#d4a373]/30 rounded-xl text-[#4a3e3e] placeholder-gray-400 focus:outline-none focus:border-[#d4a373] resize-none"
                                    required
                                />

                                {error && (
                                    <p className="text-red-500 text-sm text-center">{error}</p>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading || !content.trim()}
                                    className="w-full py-3 bg-[#4a3e3e] text-[#fdfaf3] rounded-xl font-bold hover:bg-[#5a4e4e] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <Loader2 className="animate-spin" size={20} />
                                    ) : (
                                        <>
                                            <Send size={18} /> 发送
                                        </>
                                    )}
                                </button>
                            </form>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
