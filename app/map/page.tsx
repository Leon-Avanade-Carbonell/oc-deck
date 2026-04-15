'use client';

import dynamic from 'next/dynamic';
import { BasemapSelector } from '@/components/map/BasemapSelector';
import { SampleClimateMvtToggle } from '@/components/map/toggles/sample-climate-mvt-toggle';
import { SampleClimateMvtTimePicker } from '@/components/map/toggles/sample-climate-mvt-time-picker';
import { SampleClimateMvtColormapSelector } from '@/components/map/toggles/sample-climate-mvt-colormap-selector';
import { SampleClimateMvtStretchSelector } from '@/components/map/toggles/sample-climate-mvt-stretch-selector';
import { CurrentLocationLayer } from '@/components/map/layers/CurrentLocationLayer';
import { SampleClimateMvtLayer } from '@/components/map/layers/sample-climate-mvt';
import { SampleClimateTimeSlider } from '@/components/map/climate/sample-climate-time-slider';
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
        <SampleClimateMvtLayer />
      </BaseMap>

      {/* Floating controls — top-right corner over the map */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-3">
        <BasemapSelector />
        <SampleClimateMvtToggle />
      </div>

      {/* Climate MVT colormap selector — bottom-right, above time picker */}
      <SampleClimateMvtColormapSelector />

      {/* Climate MVT stretch selector — bottom-right, above time picker */}
      <SampleClimateMvtStretchSelector />

      {/* Climate MVT time picker — bottom-right */}
      <SampleClimateMvtTimePicker />

      {/* Climate data time slider — center-bottom of map */}
      <SampleClimateTimeSlider />
    </main>
  );
}
