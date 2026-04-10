'use client';

import { useAtom } from 'jotai';
import { useMemo } from 'react';
import { GridCellLayer } from '@deck.gl/layers';
import { useSmartLayer } from '@/lib/hooks/useSmartLayer';

import {
  sampleClimateDataAtom,
  sampleClimateVisibleAtom,
  sampleClimateCurrentVariableAtom,
  sampleClimateCurrentTimeAtom,
  sampleClimateDataCacheAtom,
} from '@/lib/atoms/sample-climate';
import { useClimateData, useClimateDataForTime } from '@/lib/hooks/useClimateData';

/**
 * SampleClimateLayer
 *
 * Renders gridded climate data as a GridCellLayer with color intensity.
 * GridCellLayer aggregates data into hexagonal cells, making patterns much more visible.
 * Each cell's color represents the aggregated value within that cell.
 *
 * Architecture:
 * - useClimateData() discovers variables and available times
 * - useClimateDataForTime() fetches and caches grid data on-demand
 * - Layer reads from cache and only re-renders when data actually changes
 * - Time slider just changes an atom; no flickering during loads
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

  // Trigger data fetch for current time (if not already cached)
  useClimateDataForTime(currentVariable, currentTime);

  // Get data from cache for current time
  // Memoize to prevent dependency chain issues
  const cachedData = useMemo(() => {
    const cacheKey = `${currentVariable}/${currentTime}`;
    return cache.get(cacheKey) || [];
  }, [cache, currentVariable, currentTime]);

  // Sync cached data to display atom
  // This ensures the layer always renders the latest cached data
  useMemo(() => {
    setData(cachedData);
  }, [cachedData, setData]);

  // Calculate min/max values for color intensity scaling
  // Note: Using iteration instead of Math.min(...values) to avoid stack overflow
  // with large climate data grids (hundreds of thousands of points)
  const { minValue, maxValue } = useMemo(() => {
    if (cachedData.length === 0) {
      return { minValue: 0, maxValue: 1 };
    }

    let min = cachedData[0][2];
    let max = cachedData[0][2];

    for (let i = 1; i < cachedData.length; i++) {
      const value = cachedData[i][2];
      if (value < min) min = value;
      if (value > max) max = value;
    }

    return {
      minValue: min,
      maxValue: max === min ? max + 1 : max, // Ensure min !== max
    };
  }, [cachedData]);

  // Generate color from value using interpolation
  const getColorForValue = useMemo(
    () => (value: number): [number, number, number, number] => {
      const normalized = Math.min(Math.max((value - minValue) / (maxValue - minValue), 0), 1);

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
    [minValue, maxValue]
  );

  const layer = useMemo(
    () =>
      new GridCellLayer({
        id: 'sample-climate',
        data: visible ? cachedData : [],
        getPosition: (d: [number, number, number]) => [d[0], d[1]],
        getWeight: (d: [number, number, number]) => d[2],
        getFillColor: (d: [number, number, number]) => getColorForValue(d[2]),
        getLineColor: [200, 200, 200, 100], // Light gray cell borders
        cellSize: 10000, // ~10km cells (in meters, approximate)
        lineWidthMinPixels: 0.5,
        lineWidthMaxPixels: 1,
        stroked: true,
        filled: true,
        extruded: false,
        updateTriggers: {
          getFillColor: [minValue, maxValue],
        },
      }),
    [cachedData, visible, minValue, maxValue, getColorForValue]
  );

  useSmartLayer({
    id: 'sample-climate',
    layer,
    label: 'Climate Data',
  });

  return null;
}
