'use client';

import { useAtom } from 'jotai';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  flightsCurrentTimeAtom,
  flightsMaxTimeAtom,
  flightsPlayingAtom,
  flightsSpeedAtom,
  flightsTrailLengthAtom,
  flightsFetchStatusAtom,
} from '@/lib/atoms/flights';

const SPEED_OPTIONS = [1, 2, 5, 10, 20, 40, 50, 75, 100] as const;

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/**
 * FlightsAnimationControls
 *
 * Overlaid UI panel for controlling the TripsLayer animation:
 * play/pause, timeline scrubber, speed multiplier, and trail length.
 */
export function FlightsAnimationControls() {
  const [currentTime, setCurrentTime] = useAtom(flightsCurrentTimeAtom);
  const [maxTime] = useAtom(flightsMaxTimeAtom);
  const [playing, setPlaying] = useAtom(flightsPlayingAtom);
  const [speed, setSpeed] = useAtom(flightsSpeedAtom);
  const [trailLength, setTrailLength] = useAtom(flightsTrailLengthAtom);
  const [fetchStatus] = useAtom(flightsFetchStatusAtom);

  const isLoading = fetchStatus === 'loading';
  const hasData = maxTime > 0;

  return (
    <div className="bg-card border border-border text-card-foreground p-3 w-72 shadow-lg">
      {/* Status banner */}
      {isLoading && (
        <p className="text-xs text-muted-foreground mb-2 animate-pulse">Loading trips…</p>
      )}
      {fetchStatus === 'error' && (
        <p className="text-xs text-destructive mb-2">Failed to load trips.</p>
      )}

      {/* Timeline */}
      <div className="flex items-center gap-2 mb-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          disabled={!hasData}
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          disabled={!hasData}
          onClick={() => { setPlaying(false); setCurrentTime(0); }}
          aria-label="Reset"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>

        <span className="font-mono text-xs tabular-nums text-muted-foreground ml-auto">
          {formatSeconds(currentTime)} / {formatSeconds(maxTime)}
        </span>
      </div>

      {/* Scrubber */}
      <Slider
        min={0}
        max={maxTime || 1}
        step={1}
        value={[currentTime]}
        disabled={!hasData}
        onValueChange={([v]) => { setPlaying(false); setCurrentTime(v); }}
        className="mb-3"
        aria-label="Animation time"
      />

      {/* Speed */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-muted-foreground w-12 shrink-0">Speed</span>
        <div className="flex gap-1 flex-wrap">
          {SPEED_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`text-xs px-2 py-0.5 border transition-colors ${
                speed === s
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground'
              }`}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      {/* Trail length */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-12 shrink-0">Trail</span>
        <Slider
          min={10}
          max={300}
          step={10}
          value={[trailLength]}
          onValueChange={([v]) => setTrailLength(v)}
          className="flex-1"
          aria-label="Trail length"
        />
        <span className="font-mono text-xs text-muted-foreground w-8 text-right">{trailLength}s</span>
      </div>
    </div>
  );
}
