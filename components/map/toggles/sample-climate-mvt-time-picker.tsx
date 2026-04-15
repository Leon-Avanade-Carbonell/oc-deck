'use client';

import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useMemo, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react';
import { useHydrationAware } from '@/lib/hooks/useHydrationAware';

import {
  sampleClimateMvtTimeAtom,
  sampleClimateMvtAvailableTimesAtom,
  sampleClimateMvtIsDecodingAtom,
  sampleClimateMvtIsManualLoadingAtom
} from '@/lib/atoms/sample-climate-mvt';

/**
 * SampleClimateMvtTimePicker
 *
 * Time navigation for the MVT climate layer with play/pause and manual controls.
 * - Play: sequential stepping — waits for each frame to fully decode before
 *   advancing, then pauses 1200ms before moving to the next time step.
 * - Previous/Next: manual navigation; disables play + select while loading.
 * - Select: direct jump to any available time.
 */
export function SampleClimateMvtTimePicker() {
  const isHydrated = useHydrationAware();
  const [currentTime, setCurrentTime] = useAtom(sampleClimateMvtTimeAtom);
  const [availableTimes] = useAtom(sampleClimateMvtAvailableTimesAtom);
  const isDecoding = useAtomValue(sampleClimateMvtIsDecodingAtom);
  const isManualLoading = useAtomValue(sampleClimateMvtIsManualLoadingAtom);
  const setIsManualLoading = useSetAtom(sampleClimateMvtIsManualLoadingAtom);
  const [isPlaying, setIsPlaying] = useState(false);

  // Find current index
  const currentIndex = useMemo(() => {
    return availableTimes.indexOf(currentTime);
  }, [currentTime, availableTimes]);

  // Sequential play: advance only after the current frame has finished decoding.
  // When isDecoding flips to false (decode complete) and we're still playing,
  // wait 1200ms then advance to the next time step, which will set isDecoding
  // back to true — the timer clears and we wait for the next decode cycle.
  useEffect(() => {
    if (!isPlaying || isDecoding || availableTimes.length === 0) return;

    const timer = setTimeout(() => {
      setCurrentTime((prev) => {
        const idx = availableTimes.indexOf(prev);
        return availableTimes[(idx + 1) % availableTimes.length];
      });
    }, 1200);

    return () => clearTimeout(timer);
  }, [isPlaying, isDecoding, availableTimes, setCurrentTime]);

  if (!isHydrated || availableTimes.length === 0) {
    return null;
  }

  const handlePrevious = () => {
    setIsPlaying(false);
    setIsManualLoading(true);
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : availableTimes.length - 1;
    setCurrentTime(availableTimes[prevIndex]);
  };

  const handleNext = () => {
    setIsPlaying(false);
    setIsManualLoading(true);
    const nextIndex = (currentIndex + 1) % availableTimes.length;
    setCurrentTime(availableTimes[nextIndex]);
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSelectTime = (value: string) => {
    setIsPlaying(false);
    setIsManualLoading(true);
    setCurrentTime(value);
  };

  return (
    <div className="fixed bottom-8 right-4 z-20">
      <div className="bg-background/80 backdrop-blur-sm border border-border rounded-lg shadow-lg px-4 py-3 flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={handlePrevious}
          disabled={availableTimes.length <= 1 || isManualLoading}
          title="Previous time"
          className="h-8 w-8"
        >
          <ChevronLeft size={16} />
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={handlePlayPause}
          disabled={availableTimes.length <= 1 || isManualLoading}
          title={isPlaying ? 'Pause' : 'Play'}
          className={`h-8 w-8 ${isPlaying ? 'bg-accent text-accent-foreground' : ''}`}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={handleNext}
          disabled={availableTimes.length <= 1 || isManualLoading}
          title="Next time"
          className="h-8 w-8"
        >
          <ChevronRight size={16} />
        </Button>

        <Select value={currentTime} onValueChange={handleSelectTime} disabled={isManualLoading}>
          <SelectTrigger className="h-8 w-36 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableTimes.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="text-xs text-muted-foreground">
          {currentIndex + 1} / {availableTimes.length}
        </div>
      </div>
    </div>
  );
}
