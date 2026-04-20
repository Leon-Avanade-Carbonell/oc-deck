'use client';

import { useAtom, useSetAtom, useAtomValue } from 'jotai';
import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { planesPollIntervalAtom, planesRefreshTriggerAtom, planesFetchStatusAtom } from '@/lib/atoms/live-planes';

/**
 * PlanesPollControl
 *
 * A small floating panel with a number input (in seconds) that controls how
 * often live plane data is refreshed. The atom is updated with a 2-second
 * debounce so the polling interval only restarts once the user stops typing.
 *
 * The local input value is kept in sync with the atom on mount but diverges
 * while the user is typing — the debounce timer bridges the gap.
 */
export function PlanesPollControl() {
  const [committed, setCommitted] = useAtom(planesPollIntervalAtom);
  const triggerRefresh = useSetAtom(planesRefreshTriggerAtom);
  const fetchStatus = useAtomValue(planesFetchStatusAtom);

  // Local string state so the input feels responsive while typing
  const [draft, setDraft] = useState(String(committed));
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Keep draft in sync if the atom changes from outside this component
  useEffect(() => {
    setDraft(String(committed));
  }, [committed]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    setDraft(raw);

    clearTimeout(debounceRef.current);

    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 1) return;

    debounceRef.current = setTimeout(() => {
      setCommitted(Math.max(10, Math.round(parsed)));
    }, 2_000);
  }

  // Commit immediately on blur so tabbing away finalises the value
  function handleBlur() {
    clearTimeout(debounceRef.current);
    const parsed = Number(draft);
    if (Number.isFinite(parsed) && parsed >= 1) {
      setCommitted(Math.max(10, Math.round(parsed)));
    } else {
      // Revert to last committed value if input is invalid
      setDraft(String(committed));
    }
  }

  // Cleanup pending debounce on unmount
  useEffect(() => () => clearTimeout(debounceRef.current), []);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background/90 backdrop-blur-sm border shadow-sm">
        <button
          type="button"
          onClick={() => triggerRefresh((n) => n + 1)}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          aria-label="Refresh plane data now"
          title="Refresh now"
        >
          <RefreshCw size={12} />
        </button>
        <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
          Refresh every
        </span>
        <input
          type="number"
          min={10}
          value={draft}
          onChange={handleChange}
          onBlur={handleBlur}
          className="w-14 rounded border border-input bg-background px-1.5 py-0.5 text-xs font-mono text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
          aria-label="Poll interval in seconds"
        />
        <span className="text-xs text-muted-foreground">s</span>
      </div>

      {/* Status indicator — only shown when not ok */}
      {fetchStatus === 'rate-limited' && (
        <div className="px-3 py-1.5 rounded-lg bg-yellow-500/15 border border-yellow-500/40 text-yellow-600 dark:text-yellow-400 text-[11px] leading-snug">
          Rate limited by OpenSky (429).
          <br />
          Showing last known positions.
        </div>
      )}
      {fetchStatus === 'error' && (
        <div className="px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/40 text-red-600 dark:text-red-400 text-[11px]">
          Fetch failed. Retrying…
        </div>
      )}
    </div>
  );
}
