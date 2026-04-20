'use client';

import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { FlightsTripsLayer } from '@/components/map/layers/FlightsTrips';
import { FlightsAnimationControls } from '@/components/map/FlightsAnimationControls';
import { flightsSelectedAtom, flightsAltMapAtom } from '@/lib/atoms/flights';
import { X } from 'lucide-react';

const BaseMap = dynamic(() => import('@/components/map/BaseMap').then((m) => m.BaseMap), { ssr: false });

function FlightsMapContent() {
  const searchParams = useSearchParams();
  const requestId = searchParams.get('requestId');
  const [selected, setSelected] = useAtom(flightsSelectedAtom);
  const altMap = useAtomValue(flightsAltMapAtom);
  const liveAlt = selected ? (altMap.get(selected.icao24) ?? null) : null;

  // Close tooltip on click-outside. A short delay skips the opening click itself.
  useEffect(() => {
    if (!selected) return;
    let armed = false;
    const timer = setTimeout(() => { armed = true; }, 150);
    const handler = () => { if (armed) setSelected(null); };
    document.addEventListener('click', handler);
    return () => { clearTimeout(timer); document.removeEventListener('click', handler); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.icao24]);

  if (!requestId) {
    return (
      <main className="relative flex-1 min-h-0 overflow-hidden w-full">
        <BaseMap />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="bg-card border border-border text-card-foreground px-6 py-4 shadow-lg max-w-sm text-center pointer-events-auto">
            <p className="text-sm font-medium">No session selected</p>
            <p className="text-xs text-muted-foreground mt-1">
              Go to{' '}
              <a href="/flights" className="underline text-primary">
                /flights
              </a>{' '}
              and select a session to view its trajectory map.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex-1 min-h-0 overflow-hidden w-full">
      <BaseMap>
        <FlightsTripsLayer requestId={requestId} />
      </BaseMap>

      {/* Click tooltip */}
      {selected && (
        <div
          className="absolute z-20"
          style={{ left: selected.x + 16, top: selected.y - 8 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-card border border-border shadow-md rounded-sm px-3 py-2 min-w-[140px]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">Callsign</p>
                <p className="text-sm font-semibold font-mono leading-none">
                  {selected.callsign ?? '—'}
                </p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-2 mb-0.5">ICAO24</p>
                <p className="text-xs font-mono text-muted-foreground leading-none">
                  {selected.icao24}
                </p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-2 mb-0.5">Altitude</p>
                <p className="text-xs font-mono text-muted-foreground leading-none">
                  {liveAlt !== null ? `${Math.round(liveAlt).toLocaleString()} m` : '—'}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-muted-foreground hover:text-foreground transition-colors mt-0.5 shrink-0"
                aria-label="Close"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Animation controls — bottom-center */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
        <FlightsAnimationControls />
      </div>
    </main>
  );
}

export default function FlightsMapPage() {
  return (
    <Suspense fallback={null}>
      <FlightsMapContent />
    </Suspense>
  );
}
