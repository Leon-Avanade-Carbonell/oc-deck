'use client';

import dynamic from 'next/dynamic';

// Skip SSR — MapLibre GL uses browser APIs (WebGL, ResizeObserver, window.devicePixelRatio)
// that are not available during server-side rendering.
const BaseMap3D = dynamic(() => import('@/components/map/BaseMap3D').then((m) => m.BaseMap3D), { ssr: false });

export default function Map3DPage() {
  return (
    <main className="relative flex-1 min-h-0 overflow-hidden w-full">
      <BaseMap3D />
    </main>
  );
}
