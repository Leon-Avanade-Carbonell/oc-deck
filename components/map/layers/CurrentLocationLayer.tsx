'use client';

import { useMemo } from 'react';
import { ScatterplotLayer } from '@deck.gl/layers';
import { useAtomValue } from 'jotai';
import { currentLocationAtom } from '@/lib/atoms/map';
import { useSmartLayer } from '@/lib/hooks/useSmartLayer';

const LAYER_ID = 'current-location';

/**
 * CurrentLocationLayer renders a DeckGL ScatterplotLayer at the user's current
 * geographic position.
 *
 * ## Data source
 * Reads from `currentLocationAtom` ([longitude, latitude] | null).
 * The atom must be populated externally — see `useUserLocation` in REVISIT.md.
 *
 * ## Visibility
 * When `currentLocationAtom` is null (location unknown or denied), the layer
 * renders with empty data and shows nothing on the map.
 *
 * ## Usage
 * ```tsx
 * <BaseMap>
 *   <CurrentLocationLayer />
 * </BaseMap>
 * ```
 *
 * Pair with `useUserLocation` (REVISIT.md) to populate the atom:
 * ```tsx
 * function MapPage() {
 *   useUserLocation(); // starts watchPosition, writes to currentLocationAtom
 *   return (
 *     <div style={{ width: '100vw', height: '100vh' }}>
 *       <BaseMap>
 *         <CurrentLocationLayer />
 *       </BaseMap>
 *     </div>
 *   );
 * }
 * ```
 *
 * ## Updating
 * The layer uses DeckGL `updateTriggers` so that DeckGL only re-evaluates the
 * `getPosition` accessor when `currentLocation` changes, avoiding unnecessary
 * GPU work on unrelated renders.
 */
export function CurrentLocationLayer() {
  const currentLocation = useAtomValue(currentLocationAtom);

  const data = useMemo(() => (currentLocation ? [{ position: currentLocation }] : []), [currentLocation]);

  const layer = useMemo(
    () =>
      new ScatterplotLayer({
        id: LAYER_ID,
        data,
        getPosition: (d: { position: [number, number] }) => d.position,
        getRadius: 80,
        radiusUnits: 'meters',
        getFillColor: [59, 130, 246, 220], // blue-500 with slight transparency
        getLineColor: [255, 255, 255, 255],
        stroked: true,
        lineWidthMinPixels: 2,
        updateTriggers: {
          getPosition: currentLocation
        }
      }),
    [data, currentLocation]
  );

  useSmartLayer({
    id: LAYER_ID,
    layer,
    label: 'Current Location'
  });

  return null;
}
