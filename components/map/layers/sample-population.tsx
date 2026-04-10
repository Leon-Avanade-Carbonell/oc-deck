'use client';

import { useAtom } from 'jotai';
import { useMemo, useRef, useEffect } from 'react';
import { PolygonLayer } from '@deck.gl/layers';
import { useSmartLayer } from '@/lib/hooks/useSmartLayer';

import { samplePopulationDataAtom, samplePopulationVisibleAtom } from '@/lib/atoms/sample-population';
import { mapZoomAtom } from '@/lib/atoms/map';

/**
 * SamplePopulationLayer
 * 
 * A dynamic data layer that displays population data with zoom-aware resolution.
 * Data source: API endpoint that returns GeoJSON features with population data
 */
export function SamplePopulationLayer() {
  const [data] = useAtom(samplePopulationDataAtom);
  const [visible] = useAtom(samplePopulationVisibleAtom);
  const [zoom] = useAtom(mapZoomAtom);
  const debounceTimerRef = useRef<NodeJS.Timeout>();

  // Debounce data regeneration on zoom changes (150ms)
  useEffect(() => {
    clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      // Trigger data regeneration based on zoom
      // (handled by separate hook that listens to mapZoomAtom)
    }, 150);
    return () => clearTimeout(debounceTimerRef.current);
  }, [zoom]);

  const layer = useMemo(
    () =>
      new PolygonLayer({
        id: 'sample-population',
        data: visible ? data : [],
        stroked: true,
        filled: true,
        getLineColor: [0, 0, 0],
        getFillColor: (feature: { properties?: { population?: number } }) => {
          // Color mapping based on population
          const population = feature.properties?.population || 0;
          const normalized = Math.min(population / 100000, 1); // Normalize to 0-1
          const green = Math.round(normalized * 255);
          return [200, green, 100, 255 * 0.7]; // Gradient from brown to greenish
        },
        getLineWidth: 1,
        updateTriggers: {
          getFillColor: [data],
        },
      }),
    [data, visible]
  );

  useSmartLayer(layer);

  return null;
}
