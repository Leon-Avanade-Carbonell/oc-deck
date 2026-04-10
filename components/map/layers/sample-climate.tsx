'use client';

import { useAtom } from 'jotai';
import { useMemo, useEffect, useRef, useCallback } from 'react';
import { GridCellLayer } from '@deck.gl/layers';
import { useSmartLayer } from '@/lib/hooks/useSmartLayer';

import {
  sampleClimateDataAtom,
  sampleClimateVisibleAtom,
  sampleClimateCurrentVariableAtom,
  sampleClimateCurrentTimeAtom,
  sampleClimateDataCacheAtom,
  sampleClimateDataPreviousAtom,
  sampleClimateAnimationProgressAtom,
} from '@/lib/atoms/sample-climate';
import { useClimateData, useClimateDataForTime } from '@/lib/hooks/useClimateData';

/**
 * SampleClimateLayer
 *
 * Renders gridded climate data as a GridCellLayer with smooth color interpolation.
 * GridCellLayer aggregates data into hexagonal cells, making patterns much more visible.
 * Each cell's color represents the aggregated value within that cell.
 *
 * Animation: When switching time slices, colors smoothly interpolate from old to new
 * values over 400ms using the animationProgress atom.
 *
 * Architecture:
 * - useClimateData() discovers variables and available times
 * - useClimateDataForTime() fetches and caches grid data on-demand
 * - Layer reads from cache and only re-renders when data actually changes
 * - Animation blends old/new values using requestAnimationFrame
 *
 * Data source: Climate API (grid endpoint with columnar format)
 */
export function SampleClimateLayer() {
  // Discover variables and times
  useClimateData();

  const [, setData] = useAtom(sampleClimateDataAtom);
  const [visible] = useAtom(sampleClimateVisibleAtom);
  const [currentVariable] = useAtom(sampleClimateCurrentVariableAtom);
  const [currentTime] = useAtom(sampleClimateCurrentTimeAtom);
  const [cache] = useAtom(sampleClimateDataCacheAtom);
  const [previousData, setPreviousData] = useAtom(sampleClimateDataPreviousAtom);
  const [animationProgress, setAnimationProgress] = useAtom(sampleClimateAnimationProgressAtom);

  // Refs for animation
  const animationDurationRef = useRef(400); // 400ms transition
  const previousTimeRef = useRef<string>('');

  // Trigger data fetch for current time (if not already cached)
  useClimateDataForTime(currentVariable, currentTime);

  // Get data from cache for current time
  const cachedData = useMemo(() => {
    const cacheKey = `${currentVariable}/${currentTime}`;
    return cache.get(cacheKey) || [];
  }, [cache, currentVariable, currentTime]);

  // When time changes, start animation
  useEffect(() => {
    if (currentTime === previousTimeRef.current) return;

    // Save previous data and start animation
    if (cachedData.length > 0) {
      setPreviousData(previousData.length > 0 ? previousData : cachedData);
      setAnimationProgress(0); // Start animation
    }

    previousTimeRef.current = currentTime;
  }, [currentTime, cachedData, previousData, setPreviousData, setAnimationProgress]);

  // Animate progress from 0 to 1 over 400ms
  useEffect(() => {
    if (animationProgress >= 1) {
      setData(cachedData);
      return;
    }

    let frameId: number;
    const startTime = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / animationDurationRef.current, 1);
      setAnimationProgress(progress);

      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      } else {
        // Animation complete
        setData(cachedData);
        setPreviousData(cachedData);
      }
    };

    frameId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frameId);
  }, [animationProgress, cachedData, setData, setPreviousData, setAnimationProgress]);

  // Calculate min/max values from both current and previous data for consistent color scaling
  const { minValue, maxValue } = useMemo(() => {
    const allData = [...cachedData, ...previousData];
    if (allData.length === 0) {
      return { minValue: 0, maxValue: 1 };
    }

    let min = allData[0][2];
    let max = allData[0][2];

    for (let i = 1; i < allData.length; i++) {
      const value = allData[i][2];
      if (value < min) min = value;
      if (value > max) max = value;
    }

    return {
      minValue: min,
      maxValue: max === min ? max + 1 : max,
    };
  }, [cachedData, previousData]);

  // Helper: normalize value to 0-1 range
  const normalizeValue = useCallback(
    (value: number) => Math.min(Math.max((value - minValue) / (maxValue - minValue), 0), 1),
    [minValue, maxValue]
  );

  // Helper: convert normalized value to RGBA color using gradient
  const valueToColor = useCallback(
    (normalized: number): [number, number, number, number] => {
      // Color gradient: blue → green → yellow → orange → red
      if (normalized < 0.2) {
        // Blue to green
        const t = normalized / 0.2;
        return [
          Math.round(0 * (1 - t) + 0 * t),
          Math.round(100 * (1 - t) + 255 * t),
          Math.round(255 * (1 - t) + 0 * t),
          200,
        ];
      } else if (normalized < 0.4) {
        // Green to yellow
        const t = (normalized - 0.2) / 0.2;
        return [
          Math.round(0 * (1 - t) + 255 * t),
          Math.round(255 * (1 - t) + 255 * t),
          Math.round(0 * (1 - t) + 0 * t),
          200,
        ];
      } else if (normalized < 0.6) {
        // Yellow to orange
        const t = (normalized - 0.4) / 0.2;
        return [
          Math.round(255 * (1 - t) + 255 * t),
          Math.round(255 * (1 - t) + 140 * t),
          Math.round(0 * (1 - t) + 0 * t),
          200,
        ];
      } else {
        // Orange to red
        const t = (normalized - 0.6) / 0.4;
        return [
          Math.round(255 * (1 - t) + 139 * t),
          Math.round(140 * (1 - t) + 0 * t),
          Math.round(0 * (1 - t) + 0 * t),
          200,
        ];
      }
    },
    []
  );

  // Generate color from data point with animation interpolation
  const getColorForValue = useMemo(
    () => (d: [number, number, number]) => {
      // Find corresponding previous value (by matching lat/lon)
      let prevValue = d[2]; // Default to current value
      if (animationProgress < 1 && previousData.length > 0) {
        const matchingPrev = previousData.find((p) => p[0] === d[0] && p[1] === d[1]);
        if (matchingPrev) {
          prevValue = matchingPrev[2];
        }
      }

      // Interpolate value during animation: blend from prevValue to current
      const displayValue = prevValue * (1 - animationProgress) + d[2] * animationProgress;
      const normalized = normalizeValue(displayValue);
      return valueToColor(normalized);
    },
    [animationProgress, previousData, normalizeValue, valueToColor]
  );

  const layer = useMemo(
    () =>
      new GridCellLayer({
        id: 'sample-climate',
        data: visible ? cachedData : [],
        getPosition: (d: [number, number, number]) => [d[0], d[1]],
        getWeight: (d: [number, number, number]) => d[2],
        getFillColor: (d: [number, number, number]) => getColorForValue(d),
        getLineColor: [200, 200, 200, 100], // Light gray cell borders
        cellSize: 10000, // ~10km cells (in meters, approximate)
        lineWidthMinPixels: 0.5,
        lineWidthMaxPixels: 1,
        stroked: true,
        filled: true,
        extruded: false,
        updateTriggers: {
          getFillColor: [animationProgress, minValue, maxValue],
        },
      }),
    [cachedData, visible, animationProgress, minValue, maxValue, getColorForValue]
  );

  useSmartLayer({
    id: 'sample-climate',
    layer,
    label: 'Climate Data',
  });

  return null;
}
