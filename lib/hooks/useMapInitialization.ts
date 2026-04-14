'use client';

import { useEffect } from 'react';
import { useMap } from 'react-map-gl/maplibre';
import { useSetAtom } from 'jotai';
import { mapInstanceAtom, mapZoomAtom } from '@/lib/atoms/map';

/**
 * Writes the underlying MapLibre GL map instance to `mapInstanceAtom` when the
 * map mounts, and clears it when the component unmounts.
 *
 * Also syncs the current map zoom level to `mapZoomAtom` whenever the map zoom changes.
 * This allows layers to adapt their resolution or data fetching based on zoom level.
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
 *
 * Consumers that need the current zoom level can read `mapZoomAtom`:
 * ```ts
 * const zoom = useAtomValue(mapZoomAtom);
 * ```
 */
export function useMapInitialization(): void {
  const { current: mapRef } = useMap();
  const setMapInstance = useSetAtom(mapInstanceAtom);
  const setMapZoom = useSetAtom(mapZoomAtom);

  useEffect(() => {
    if (!mapRef) return;

    const mapInstance = mapRef.getMap();
    setMapInstance(mapInstance);

    // Sync initial zoom
    setMapZoom(mapInstance.getZoom());

    // Listen for zoom changes
    const handleZoom = () => {
      setMapZoom(mapInstance.getZoom());
    };

    mapInstance.on('zoom', handleZoom);

    return () => {
      mapInstance.off('zoom', handleZoom);
      setMapInstance(null);
    };
  }, [mapRef, setMapInstance, setMapZoom]);
}
