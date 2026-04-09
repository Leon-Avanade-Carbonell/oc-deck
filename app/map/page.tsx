'use client';

import dynamic from 'next/dynamic';
import { BasemapSelector } from '@/components/map/BasemapSelector';
import { CurrentLocationLayer } from '@/components/map/layers/CurrentLocationLayer';
import { SampleHexLayer } from '@/components/map/layers/sample-HexLayer';
import { SampleHexTooltip } from '@/components/map/sample-HexTooltip';
import { SampleHexToggle } from '@/components/map/sample-HexToggle';
import { useUserLocation } from '@/lib/hooks/useUserLocation';

// Skip SSR for BaseMap — MapLibre GL uses browser APIs (WebGL, ResizeObserver,
// window.devicePixelRatio) that are not available during server-side rendering.
const BaseMap = dynamic(() => import('@/components/map/BaseMap').then((m) => m.BaseMap), { ssr: false });

export default function MapPage() {
  useUserLocation();

  return (
    // min-h-0 is required on flex children that contain overflowing content.
    // Without it, the default min-height: auto prevents the map from being
    // constrained to the available space.
    <main className="relative flex-1 min-h-0 overflow-hidden w-full">
      <BaseMap>
        <CurrentLocationLayer />
        <SampleHexLayer />
      </BaseMap>

      {/* Floating basemap selector — top-right corner over the map */}
      <div className="absolute top-4 right-4 z-10">
        <BasemapSelector />
      </div>

      {/* Floating sample hex layer toggle — top-right, next to basemap selector */}
      <div className="absolute top-4 right-56 z-10">
        <SampleHexToggle />
      </div>

      {/* Hex tooltip overlay */}
      <SampleHexTooltip />
    </main>
  );
}
