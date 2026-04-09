'use client';

import { useEffect } from 'react';
import { useSetAtom } from 'jotai';
import { currentLocationAtom } from '@/lib/atoms/map';

/**
 * Starts a `navigator.geolocation.watchPosition` subscription and writes the
 * user's current position to `currentLocationAtom` as [longitude, latitude].
 *
 * Call this hook once in the page/component that needs location tracking.
 * `CurrentLocationLayer` will automatically react to atom changes.
 *
 * The watch is cleared on unmount.
 *
 * Permission errors are logged as warnings — see REVISIT.md for a full
 * permission-denied UI flow.
 *
 * Usage:
 * ```tsx
 * function MapPage() {
 *   useUserLocation();
 *   return <BaseMap><CurrentLocationLayer /></BaseMap>;
 * }
 * ```
 */
export function useUserLocation(): void {
  const setLocation = useSetAtom(currentLocationAtom);

  useEffect(() => {
    if (!navigator.geolocation) {
      console.warn('useUserLocation: Geolocation is not supported by this browser.');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setLocation([pos.coords.longitude, pos.coords.latitude]);
      },
      (err) => {
        console.warn('useUserLocation: Geolocation error:', err.message);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      setLocation(null);
    };
  }, [setLocation]);
}
