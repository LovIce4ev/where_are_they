"use client";

import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, MessageSquare, Calendar, User, Loader2, Search } from 'lucide-react';
import { createProfile } from '@/lib/supabase';

interface AddProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

// 城市搜索结果类型
interface CityResult {
    display_name: string;
    lat: string;
    lon: string;
}

export default function AddProfileModal({ isOpen, onClose, onSuccess }: AddProfileModalProps) {
    const [username, setUsername] = useState('');
    const [cityQuery, setCityQuery] = useState('');
    const [selectedCity, setSelectedCity] = useState<CityResult | null>(null);
    const [cityResults, setCityResults] = useState<CityResult[]>([]);
    const [statusText, setStatusText] = useState('');
    const [returnDate, setReturnDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // FIXME: 原实现的 setTimeout 返回值未正确清理，导致内存泄漏
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // 使用 Nominatim API 搜索城市
    const searchCity = useCallback(async (query: string) => {
        if (query.length < 2) {
            setCityResults([]);
            return;
        }

        setSearching(true);
        try {
            const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
            if (!response.ok) throw new Error('搜索失败');
            const data = await response.json();
            setCityResults(data);
        } catch (err) {
            console.error('City search error:', err);
        } finally {
            setSearching(false);
        }
    }, []);

    // 延迟搜索 — 使用 ref 正确清理上一次定时器
    const handleCityInputChange = (value: string) => {
        setCityQuery(value);
        setSelectedCity(null);

        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
            searchCity(value);
            debounceTimerRef.current = null;
        }, 300);
    };

    const handleCitySelect = (city: CityResult) => {
        setSelectedCity(city);
        setCityQuery(city.display_name.split(',')[0]); // 只显示城市名
        setCityResults([]);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedCity) {
            setError('请从列表中选择一个城市');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { error } = await createProfile({
                username,
                current_city: cityQuery,
                lat: parseFloat(selectedCity.lat),
                lng: parseFloat(selectedCity.lon),
                status_text: statusText,
                return_date: returnDate,
                avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
            });

            if (error) throw error;

            onSuccess();
            onClose();
            resetForm();
        } catch (err: any) {
            setError(err.message || '添加失败，请重试');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setUsername('');
        setCityQuery('');
        setSelectedCity(null);
        setCityResults([]);
        setStatusText('');
        setReturnDate('');
        setError(null);
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
                        className="bg-[#fdfaf3] rounded-3xl p-8 shadow-2xl border border-[#d4a373]/30 w-[90%] max-w-[450px] max-h-[90vh] overflow-y-auto relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 p-1 hover:bg-black/5 rounded-full"
                        >
                            <X size={20} className="text-[#4a3e3e]" />
                        </button>

                        <h2 className="text-2xl font-bold text-[#4a3e3e] text-center mb-2">
                            添加我的位置 📍
                        </h2>
                        <p className="text-sm text-[#d4a373] text-center mb-6">
                            让大家知道你在哪里
                        </p>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* 名字 */}
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-[#d4a373]" size={18} />
                                <input
                                    type="text"
                                    placeholder="你的名字"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                    className="w-full pl-10 pr-4 py-3 bg-white border border-[#d4a373]/30 rounded-xl text-[#4a3e3e] placeholder-gray-400 focus:outline-none focus:border-[#d4a373]"
                                />
                            </div>

                            {/* 城市搜索 */}
                            <div className="relative">
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-[#d4a373]" size={18} />
                                <input
                                    type="text"
                                    placeholder="搜索城市（如：北京、东京、伦敦）"
                                    value={cityQuery}
                                    onChange={(e) => handleCityInputChange(e.target.value)}
                                    required
                                    className="w-full pl-10 pr-10 py-3 bg-white border border-[#d4a373]/30 rounded-xl text-[#4a3e3e] placeholder-gray-400 focus:outline-none focus:border-[#d4a373]"
                                />
                                {searching && (
                                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-[#d4a373] animate-spin" size={18} />
                                )}

                                {/* 城市搜索结果 */}
                                {cityResults.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#d4a373]/30 rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto">
                                        {cityResults.map((city, index) => (
                                            <button
                                                key={index}
                                                type="button"
                                                onClick={() => handleCitySelect(city)}
                                                className="w-full px-4 py-3 text-left text-[#4a3e3e] hover:bg-[#d4a373]/10 first:rounded-t-xl last:rounded-b-xl text-sm"
                                            >
                                                <div className="font-medium">{city.display_name.split(',')[0]}</div>
                                                <div className="text-xs text-gray-400 truncate">{city.display_name}</div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* 显示已选城市 */}
                            {selectedCity && (
                                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2 text-sm text-green-700">
                                    ✓ 已选择：{cityQuery}
                                </div>
                            )}

                            {/* 状态 */}
                            <div className="relative">
                                <MessageSquare className="absolute left-3 top-3 text-[#d4a373]" size={18} />
                                <textarea
                                    placeholder="你的近况..."
                                    value={statusText}
                                    onChange={(e) => setStatusText(e.target.value)}
                                    rows={2}
                                    className="w-full pl-10 pr-4 py-3 bg-white border border-[#d4a373]/30 rounded-xl text-[#4a3e3e] placeholder-gray-400 focus:outline-none focus:border-[#d4a373] resize-none"
                                />
                            </div>

                            {/* 回家时间 */}
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-[#d4a373]" size={18} />
                                <input
                                    type="text"
                                    placeholder="什么时候回清迈？(如: 下个月、15天后)"
                                    value={returnDate}
                                    onChange={(e) => setReturnDate(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-white border border-[#d4a373]/30 rounded-xl text-[#4a3e3e] placeholder-gray-400 focus:outline-none focus:border-[#d4a373]"
                                />
                            </div>

                            {error && (
                                <p className="text-red-500 text-sm text-center">{error}</p>
                            )}

                            <button
                                type="submit"
                                disabled={loading || !selectedCity}
                                className="w-full py-3 bg-[#4a3e3e] text-[#fdfaf3] rounded-xl font-bold hover:bg-[#5a4e4e] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <Loader2 className="animate-spin" size={20} />
                                ) : (
                                    '添加到地图 🗺️'
                                )}
                            </button>
                        </form>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
