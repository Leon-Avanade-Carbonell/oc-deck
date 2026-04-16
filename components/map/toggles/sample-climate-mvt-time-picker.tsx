'use client';

import { useAtom, useAtomValue } from 'jotai';
import { useMemo, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react';
import { useHydrationAware } from '@/lib/hooks/useHydrationAware';

import {
  sampleClimateMvtTimeAtom,
  sampleClimateMvtAvailableTimesAtom,
  sampleClimateMvtIsDecodingAtom
} from '@/lib/atoms/sample-climate-mvt';

/**
 * SampleClimateMvtTimePicker
 *
 * Time navigation for the MVT climate layer with play/pause and manual controls.
 * - Play: sequential stepping — waits for each frame to fully decode before
 *   advancing, then pauses 1200ms before moving to the next time step.
 * - Previous/Next/Select: manual navigation.
 *
 * Controls are disabled when `isDecoding && !isPlaying`:
 * - Manual step: isPlaying=false → all controls disabled while loading ✓
 * - Zoom-triggered decode: isPlaying=false → all controls disabled ✓
 * - During play: isPlaying=true → controls NOT disabled; pause remains clickable ✓
 */
export function SampleClimateMvtTimePicker() {
  const isHydrated = useHydrationAware();
  const [currentTime, setCurrentTime] = useAtom(sampleClimateMvtTimeAtom);
  const [availableTimes] = useAtom(sampleClimateMvtAvailableTimesAtom);
  const isDecoding = useAtomValue(sampleClimateMvtIsDecodingAtom);
  const [isPlaying, setIsPlaying] = useState(false);

  // Find current index
  const currentIndex = useMemo(() => {
    return availableTimes.indexOf(currentTime);
  }, [currentTime, availableTimes]);

  // Sequential play: advance only after the current frame has finished decoding.
  // When isDecoding flips to false (decode complete) and we're still playing,
  // wait 1200ms then advance to the next time step, which will set isDecoding
  // back to true — the timer clears and we wait for the next decode cycle.
  //
  // currentTime is included in deps so that a cache-hit decode (which never
  // flips isDecoding true→false) still re-arms the timer: time changes →
  // effect re-runs → new 1200ms timer → next advance. For non-cached decodes,
  // the timer created here is cancelled moments later when isDecoding goes true,
  // then re-created when isDecoding returns to false — same net behaviour as before.
  useEffect(() => {
    if (!isPlaying || isDecoding || availableTimes.length === 0) return;

    const timer = setTimeout(() => {
      setCurrentTime((prev) => {
        const idx = availableTimes.indexOf(prev);
        return availableTimes[(idx + 1) % availableTimes.length];
      });
    }, 1200);

    return () => clearTimeout(timer);
  }, [isPlaying, isDecoding, availableTimes, setCurrentTime, currentTime]);

  if (!isHydrated || availableTimes.length === 0) {
    return null;
  }

  // Disable all controls when a decode is in flight and we're not in play mode.
  // During play, isPlaying=true so controls stay enabled (pause remains clickable).
  const controlsDisabled = isDecoding && !isPlaying;
  const tooFewTimes = availableTimes.length <= 1;

  const handlePrevious = () => {
    setIsPlaying(false);
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : availableTimes.length - 1;
    setCurrentTime(availableTimes[prevIndex]);
  };

  const handleNext = () => {
    setIsPlaying(false);
    const nextIndex = (currentIndex + 1) % availableTimes.length;
    setCurrentTime(availableTimes[nextIndex]);
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSliderChange = (value: number[]) => {
    if (value[0] !== undefined) {
      setIsPlaying(false);
      setCurrentTime(availableTimes[value[0]]);
    }
  };

  return (
    <div className="w-[600px] max-w-[90vw] bg-background/95 backdrop-blur-sm border border-border rounded-xl shadow-lg px-4 py-3 flex items-center gap-4">
      {/* Controls */}
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePrevious}
          disabled={tooFewTimes || controlsDisabled}
          title="Previous time"
          className="h-8 w-8 rounded-full"
        >
          <ChevronLeft size={16} />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={handlePlayPause}
          disabled={tooFewTimes || controlsDisabled}
          title={isPlaying ? 'Pause' : 'Play'}
          className={`h-8 w-8 rounded-full ${isPlaying ? 'bg-accent text-accent-foreground' : ''}`}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleNext}
          disabled={tooFewTimes || controlsDisabled}
          title="Next time"
          className="h-8 w-8 rounded-full"
        >
          <ChevronRight size={16} />
        </Button>
      </div>

      {/* Slider Track */}
      <div className="flex-1 px-2">
        <Slider
          value={[currentIndex]}
          min={0}
          max={availableTimes.length - 1}
          step={1}
          onValueChange={handleSliderChange}
          disabled={tooFewTimes || controlsDisabled}
          className="cursor-pointer"
        />
      </div>

      {/* Text Info */}
      <div className="shrink-0 flex flex-col items-end min-w-[120px]">
        <div className="text-sm font-medium whitespace-nowrap">{currentTime}</div>
        <div className="text-xs text-muted-foreground whitespace-nowrap">
          {currentIndex + 1} / {availableTimes.length}
        </div>
      </div>
    </div>
  );
}
