"use client";

import React, { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Camera, Loader2 } from 'lucide-react';

interface AvatarUploadProps {
    userId: string;
    currentAvatarUrl: string;
    onUploadComplete: (newUrl: string) => void;
}

export default function AvatarUpload({ userId, currentAvatarUrl, onUploadComplete }: AvatarUploadProps) {
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            setUploading(true);

            if (!event.target.files || event.target.files.length === 0) {
                throw new Error('请选择要上传的图片');
            }

            const file = event.target.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `${userId}-${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            // 1. 上传图片到 Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file);

            if (uploadError) {
                throw uploadError;
            }

            // 2. 获取公开访问 URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            // 3. 更新数据库中的用户信息 (如果需要)
            // NOTE: 这里可以根据具体业务决定是否在这里直接更新 profile 表
            // 为了保持组件通用，我们主要通过回调通知父组件
            onUploadComplete(publicUrl);

        } catch (error: any) {
            alert(error.message || '上传失败，请稍后重试');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="relative group">
            <div className="w-20 h-20 rounded-full border-4 border-white shadow-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                {uploading ? (
                    <Loader2 className="w-8 h-8 text-[#d4a373] animate-spin" />
                ) : (
                    <img
                        src={currentAvatarUrl}
                        alt="Avatar"
                        className="w-full h-full object-cover group-hover:opacity-75 transition-opacity"
                    />
                )}
            </div>

            <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
            >
                {!uploading && <Camera className="text-white" size={24} />}
            </button>

            <input
                type="file"
                ref={fileInputRef}
                onChange={handleUpload}
                accept="image/*"
                className="hidden"
            />
        </div>
    );
}
