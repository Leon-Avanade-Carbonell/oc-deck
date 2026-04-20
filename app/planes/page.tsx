'use client';

import dynamic from 'next/dynamic';
import { useAtomValue } from 'jotai';
import { LivePlanesLayer } from '@/components/map/layers/LivePlanes';
import { LivePlanesToggle } from '@/components/map/toggles/live-planes-toggle';
import { livePlanesHoveredAtom } from '@/lib/atoms/live-planes';
import { PlaneDetailsPanel } from '@/components/map/PlaneDetailsPanel';
import { AvanadeTitle } from '@/components/map/layers/AvanadeTitle';
import { AvanadeTitleToggle } from '@/components/map/toggles/avanade-title-toggle';
import { PlanesPollControl } from '@/components/map/PlanesPollControl';

// Skip SSR for BaseMap — MapLibre GL uses browser APIs (WebGL, ResizeObserver,
// window.devicePixelRatio) that are not available during server-side rendering.
const BaseMap = dynamic(() => import('@/components/map/BaseMap').then((m) => m.BaseMap), { ssr: false });

export default function PlanesPage() {
  const hovered = useAtomValue(livePlanesHoveredAtom);

  return (
    <main className="relative flex-1 min-h-0 overflow-hidden w-full">
      <BaseMap>
        <LivePlanesLayer />
      </BaseMap>

      {/* Top-right toggles */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <LivePlanesToggle />
        <AvanadeTitleToggle />
      </div>

      {/* Avanade title — screen-centered overlay */}
      <AvanadeTitle />

      {/* Hover tooltip — follows the cursor */}
      {hovered && (
        <div className="absolute z-20 pointer-events-none" style={{ left: hovered.x + 12, top: hovered.y + 12 }}>
          <div className="border-2 border-dotted border-white bg-black/70 text-white text-xs px-2 py-1.5 leading-5 backdrop-blur-sm">
            <div>
              <span className="text-white/50 uppercase tracking-wider text-[10px]">Callsign</span>
              <br />
              <span className="font-mono font-semibold">{hovered.plane.callsign ?? '—'}</span>
            </div>
            <div className="mt-1">
              <span className="text-white/50 uppercase tracking-wider text-[10px]">ICAO24</span>
              <br />
              <span className="font-mono">{hovered.plane.icao24}</span>
            </div>
          </div>
        </div>
      )}

      {/* Selected plane details panel — bottom-right */}
      <PlaneDetailsPanel />

      {/* Poll interval control — top-left */}
      <div className="absolute top-4 left-4 z-10">
        <PlanesPollControl />
      </div>
    </main>
  );
}
