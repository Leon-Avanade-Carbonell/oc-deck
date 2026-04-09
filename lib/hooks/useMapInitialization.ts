'use client';

import { useEffect } from 'react';
import { useMap } from 'react-map-gl/maplibre';
import { useSetAtom } from 'jotai';
import { mapInstanceAtom } from '@/lib/atoms/map';

/**
 * Writes the underlying MapLibre GL map instance to `mapInstanceAtom` when the
 * map mounts, and clears it when the component unmounts.
 *
 * Must be called inside a component that is rendered within a `<Map>` context
 * from `react-map-gl/maplibre` (i.e., as a child of BaseMap).
 *
 * Usage: called internally by BaseMap via a MapInitializer child component.
 *
 * Consumers that need the raw map instance can read `mapInstanceAtom`:
 * ```ts
 * const map = useAtomValue(mapInstanceAtom);
 * map?.flyTo({ center: [lng, lat], zoom: 14 });
 * ```
 */
export function useMapInitialization(): void {
  const { current: mapRef } = useMap();
  const setMapInstance = useSetAtom(mapInstanceAtom);

  useEffect(() => {
    if (!mapRef) return;

    const mapInstance = mapRef.getMap();
    setMapInstance(mapInstance);

    return () => {
      setMapInstance(null);
    };
  }, [mapRef, setMapInstance]);
}
