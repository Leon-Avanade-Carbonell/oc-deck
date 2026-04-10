'use client';

import { useAtom } from 'jotai';
import { useMemo, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';

import {
  sampleClimateCurrentTimeAtom,
  sampleClimateAvailableTimesAtom,
  sampleClimateDataCacheAtom,
  sampleClimateLoadingTimesAtom,
  sampleClimateCurrentVariableAtom,
  sampleClimatePlayingAtom,
} from '@/lib/atoms/sample-climate';

/**
 * SampleClimateTimeSlider
 *
 * Floating time navigation slider positioned at center-bottom of map.
 * Allows users to manually navigate or play through time steps in the climate dataset.
 *
 * Features:
 * - Manual navigation: slider, back/next buttons
 * - Playback controls: play/stop button advances through times every 0.75s
 * - Shows loading indicator only if the selected time's data is being fetched
 * - Switches instantly to already-cached times (no flickering)
 * - Displays current time and position in the timeline
 *
 * Styled with backdrop blur and theme colors.
 */
export function SampleClimateTimeSlider() {
  const [currentTime, setCurrentTime] = useAtom(sampleClimateCurrentTimeAtom);
  const [availableTimes] = useAtom(sampleClimateAvailableTimesAtom);
  const [cache] = useAtom(sampleClimateDataCacheAtom);
  const [loadingTimes] = useAtom(sampleClimateLoadingTimesAtom);
  const [currentVariable] = useAtom(sampleClimateCurrentVariableAtom);
  const [isPlaying, setIsPlaying] = useAtom(sampleClimatePlayingAtom);

  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Map current time to slider index
  const currentIndex = useMemo(() => {
    return availableTimes.indexOf(currentTime);
  }, [currentTime, availableTimes]);

  // Format time string for display (e.g., "1989-01-16 12:00:00" → "1989-01-16")
  const formattedTime = useMemo(() => {
    if (!currentTime) return 'Loading...';
    // Extract just the date part if it includes time
    return currentTime.split(' ')[0] || currentTime;
  }, [currentTime]);

  // Check if current time's data is being fetched
  const cacheKey = `${currentVariable}/${currentTime}`;
  const isLoadingCurrentTime = loadingTimes.has(cacheKey);

  // Check if current time is already cached
  const isCurrentTimeCached = cache.has(cacheKey);

  // Handle playback interval
  useEffect(() => {
    if (!isPlaying || availableTimes.length === 0) {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
        playbackIntervalRef.current = null;
      }
      return;
    }

    // Start playback interval (0.75 seconds per frame)
    playbackIntervalRef.current = setInterval(() => {
      setCurrentTime((prevTime) => {
        const prevIndex = availableTimes.indexOf(prevTime);
        const nextIndex = (prevIndex + 1) % availableTimes.length;

        // Stop playing when reaching the end and looping back
        if (nextIndex === 0) {
          setIsPlaying(false);
          return availableTimes[nextIndex];
        }

        return availableTimes[nextIndex];
      });
    }, 750); // 0.75 seconds

    return () => {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
        playbackIntervalRef.current = null;
      }
    };
  }, [isPlaying, availableTimes, setCurrentTime, setIsPlaying]);

  // Handle slider change
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newIndex = parseInt(e.target.value, 10);
    if (newIndex >= 0 && newIndex < availableTimes.length) {
      setCurrentTime(availableTimes[newIndex]);
      // Pause playback when user manually changes time
      setIsPlaying(false);
    }
  };

  // Handle back button
  const handlePrevious = () => {
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : availableTimes.length - 1;
    setCurrentTime(availableTimes[prevIndex]);
    setIsPlaying(false);
  };

  // Handle next button
  const handleNext = () => {
    const nextIndex = (currentIndex + 1) % availableTimes.length;
    setCurrentTime(availableTimes[nextIndex]);
    setIsPlaying(false);
  };

  // Handle play/stop button
  const handlePlayToggle = () => {
    setIsPlaying(!isPlaying);
  };

  if (availableTimes.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-20">
      <div className="bg-background/80 backdrop-blur-sm border border-border rounded-lg shadow-lg px-6 py-4 w-96">
        {/* Time display */}
        <div className="text-center mb-3">
          <span className="text-sm font-medium text-muted-foreground">Time</span>
          <p
            className={`text-lg font-semibold transition-opacity ${
              isLoadingCurrentTime ? 'opacity-60' : 'opacity-100'
            }`}
          >
            {formattedTime}
          </p>
        </div>

        {/* Slider */}
        <input
          type="range"
          value={Math.max(currentIndex, 0)}
          onChange={handleSliderChange}
          min={0}
          max={Math.max(availableTimes.length - 1, 0)}
          step={1}
          className="w-full cursor-pointer"
        />

        {/* Time range info */}
        <div className="text-xs text-muted-foreground text-center mt-2">
          {currentIndex + 1} / {availableTimes.length}
        </div>

        {/* Playback controls */}
        <div className="flex items-center justify-center gap-2 mt-4">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePrevious}
            disabled={availableTimes.length <= 1}
            title="Previous time step"
            className="h-8 w-8"
          >
            <SkipBack size={16} />
          </Button>

          <Button
            variant="default"
            size="icon"
            onClick={handlePlayToggle}
            disabled={availableTimes.length <= 1}
            title={isPlaying ? 'Stop playback' : 'Start playback'}
            className={`h-8 w-8 ${isPlaying ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={handleNext}
            disabled={availableTimes.length <= 1}
            title="Next time step"
            className="h-8 w-8"
          >
            <SkipForward size={16} />
          </Button>
        </div>

        {/* Status indicators */}
        <div className="mt-2 flex items-center justify-center gap-2 min-h-5">
          {isCurrentTimeCached && !isLoadingCurrentTime && (
            <span className="text-xs text-green-600">✓ Loaded</span>
          )}
          {isLoadingCurrentTime && (
            <span className="text-xs text-amber-600 animate-pulse">⟳ Loading...</span>
          )}
          {isPlaying && (
            <span className="text-xs text-green-600 animate-pulse">▶ Playing</span>
          )}
        </div>
      </div>
    </div>
  );
}
