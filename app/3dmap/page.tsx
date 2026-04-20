'use client';

import dynamic from 'next/dynamic';

// Skip SSR — DeckGL requires WebGL which is only available in the browser.
const Globe3DMap = dynamic(() => import('@/components/map/Globe3DMap').then((m) => m.Globe3DMap), { ssr: false });

export default function Map3DPage() {
  return (
    <main className="relative flex-1 min-h-0 overflow-hidden w-full">
      <Globe3DMap />
    </main>
  );
}
