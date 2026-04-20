'use client';

import { useEffect } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { X } from 'lucide-react';
import { flightsSelectedAtom, flightsAltMapAtom } from '@/lib/atoms/flights';

/**
 * Flights3DTooltip
 *
 * Click tooltip for the 3D flights map (/flights/3dmap).
 * Shows callsign, ICAO24, and live interpolated altitude for the selected plane.
 *
 * Intentionally separate from the inline tooltip in FlightsMapPage so the
 * 3D experience can evolve independently (e.g. adding vertical rate display).
 *
 * Dismisses when the user clicks outside the tooltip.
 */
export function Flights3DTooltip() {
  const [selected, setSelected] = useAtom(flightsSelectedAtom);
  const altMap = useAtomValue(flightsAltMapAtom);
  const liveAlt = selected ? (altMap.get(selected.icao24) ?? null) : null;

  // Close on click-outside. Short delay skips the opening click itself.
  useEffect(() => {
    if (!selected) return;
    let armed = false;
    const timer = setTimeout(() => {
      armed = true;
    }, 150);
    const handler = () => {
      if (armed) setSelected(null);
    };
    document.addEventListener('click', handler);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.icao24]);

  if (!selected) return null;

  return (
    <div
      className="absolute z-20"
      style={{ left: selected.x + 16, top: selected.y - 8 }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-card border border-border shadow-md rounded-sm px-3 py-2 min-w-[140px]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">Callsign</p>
            <p className="text-sm font-semibold font-mono leading-none">{selected.callsign ?? '—'}</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-2 mb-0.5">ICAO24</p>
            <p className="text-xs font-mono text-muted-foreground leading-none">{selected.icao24}</p>
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
  );
}
