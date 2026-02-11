"use client";

import dynamic from 'next/dynamic';

// 关键修复：动态导入地图组件，并强制关闭服务器端渲染 (SSR)
// 因为 Leaflet 需要浏览器环境中的 'window' 对象
const ConnectionMap = dynamic(
  () => import('@/components/map/ConnectionMap'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-screen bg-[#fdfaf3] flex items-center justify-center">
        <div className="text-[#d4a373] animate-pulse font-serif italic text-lg">
          正在铺开情感地图...
        </div>
      </div>
    )
  }
);

export default function Home() {
  return (
    <main>
      <ConnectionMap />
    </main>
  );
}
