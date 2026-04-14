'use client';

import { useAtom } from 'jotai';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useHydrationAware } from '@/lib/hooks/useHydrationAware';

import { sampleClimateMvtTimeAtom, sampleClimateMvtAvailableTimesAtom } from '@/lib/atoms/sample-climate-mvt';

/**
 * SampleClimateMvtTimePicker
 *
 * Simple time navigation for the MVT climate layer.
 * Shows current time and provides next/previous buttons.
 */
export function SampleClimateMvtTimePicker() {
  const isHydrated = useHydrationAware();
  const [currentTime, setCurrentTime] = useAtom(sampleClimateMvtTimeAtom);
  const [availableTimes] = useAtom(sampleClimateMvtAvailableTimesAtom);

  // Find current index
  const currentIndex = useMemo(() => {
    return availableTimes.indexOf(currentTime);
  }, [currentTime, availableTimes]);

  if (!isHydrated || availableTimes.length === 0) {
    return null;
  }

  const handlePrevious = () => {
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : availableTimes.length - 1;
    setCurrentTime(availableTimes[prevIndex]);
  };

  const handleNext = () => {
    const nextIndex = (currentIndex + 1) % availableTimes.length;
    setCurrentTime(availableTimes[nextIndex]);
  };

  return (
    <div className="fixed bottom-8 right-4 z-20">
      <div className="bg-background/80 backdrop-blur-sm border border-border rounded-lg shadow-lg px-4 py-3 flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={handlePrevious}
          disabled={availableTimes.length <= 1}
          title="Previous time"
          className="h-8 w-8"
        >
          <ChevronLeft size={16} />
        </Button>

        <span className="text-sm font-medium min-w-32 text-center">{currentTime}</span>

        <Button
          variant="outline"
          size="icon"
          onClick={handleNext}
          disabled={availableTimes.length <= 1}
          title="Next time"
          className="h-8 w-8"
        >
          <ChevronRight size={16} />
        </Button>

        <div className="text-xs text-muted-foreground ml-2">
          {currentIndex + 1} / {availableTimes.length}
        </div>
      </div>
    </div>
  );
}
