'use client';

import dynamic from 'next/dynamic';
import { LivePlanesLayer } from '@/components/map/layers/LivePlanes';
import { LivePlanesToggle } from '@/components/map/toggles/live-planes-toggle';

// Skip SSR for BaseMap — MapLibre GL uses browser APIs (WebGL, ResizeObserver,
// window.devicePixelRatio) that are not available during server-side rendering.
const BaseMap = dynamic(() => import('@/components/map/BaseMap').then((m) => m.BaseMap), { ssr: false });

export default function PlanesPage() {
  return (
    <main className="relative flex-1 min-h-0 overflow-hidden w-full">
      <BaseMap>
        <LivePlanesLayer />
      </BaseMap>

      {/* Top-right toggle */}
      <div className="absolute top-4 right-4 z-10">
        <LivePlanesToggle />
      </div>
    </main>
  );
}
