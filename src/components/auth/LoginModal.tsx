"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Lock, User, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
    const { signIn, signUp } = useAuth();
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            if (isSignUp) {
                const { error } = await signUp(email, password, username);
                if (error) throw error;
                setSuccess('注册成功！请检查邮箱确认链接。');
            } else {
                const { error } = await signIn(email, password);
                if (error) throw error;
                onClose();
            }
        } catch (err: any) {
            setError(err.message || '操作失败，请重试');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setEmail('');
        setPassword('');
        setUsername('');
        setError(null);
        setSuccess(null);
    };

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
                        className="bg-[#fdfaf3] rounded-3xl p-8 shadow-2xl border border-[#d4a373]/30 w-[90%] max-w-[400px]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 p-1 hover:bg-black/5 rounded-full"
                        >
                            <X size={20} className="text-[#4a3e3e]" />
                        </button>

                        <h2 className="text-2xl font-bold text-[#4a3e3e] text-center mb-6">
                            {isSignUp ? '加入我们 ✨' : '欢迎回家 🏠'}
                        </h2>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {isSignUp && (
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-[#d4a373]" size={18} />
                                    <input
                                        type="text"
                                        placeholder="你的名字"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        required={isSignUp}
                                        className="w-full pl-10 pr-4 py-3 bg-white border border-[#d4a373]/30 rounded-xl text-[#4a3e3e] placeholder-gray-400 focus:outline-none focus:border-[#d4a373]"
                                    />
                                </div>
                            )}

                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-[#d4a373]" size={18} />
                                <input
                                    type="email"
                                    placeholder="邮箱"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="w-full pl-10 pr-4 py-3 bg-white border border-[#d4a373]/30 rounded-xl text-[#4a3e3e] placeholder-gray-400 focus:outline-none focus:border-[#d4a373]"
                                />
                            </div>

                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-[#d4a373]" size={18} />
                                <input
                                    type="password"
                                    placeholder="密码"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    className="w-full pl-10 pr-4 py-3 bg-white border border-[#d4a373]/30 rounded-xl text-[#4a3e3e] placeholder-gray-400 focus:outline-none focus:border-[#d4a373]"
                                />
                            </div>

                            {error && (
                                <p className="text-red-500 text-sm text-center">{error}</p>
                            )}

                            {success && (
                                <p className="text-green-600 text-sm text-center">{success}</p>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 bg-[#4a3e3e] text-[#fdfaf3] rounded-xl font-bold hover:bg-[#5a4e4e] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <Loader2 className="animate-spin" size={20} />
                                ) : (
                                    isSignUp ? '注册' : '登录'
                                )}
                            </button>
                        </form>

                        <div className="mt-6 text-center">
                            <button
                                onClick={() => {
                                    setIsSignUp(!isSignUp);
                                    resetForm();
                                }}
                                className="text-[#d4a373] hover:underline text-sm"
                            >
                                {isSignUp ? '已有账号？去登录' : '没有账号？去注册'}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
