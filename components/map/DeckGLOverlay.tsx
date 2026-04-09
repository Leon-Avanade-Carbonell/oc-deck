'use client';

import { useLayoutEffect, useRef } from 'react';
import { useControl } from 'react-map-gl/maplibre';
import { MapboxOverlay } from '@deck.gl/mapbox';
import type { MapboxOverlayProps } from '@deck.gl/mapbox';
import { useSetAtom } from 'jotai';
import { deckglOverlayAtom } from '@/lib/atoms/map';

type DeckGLOverlayProps = MapboxOverlayProps & {
  interleaved?: boolean;
};

/**
 * Internal component that mounts a DeckGL `MapboxOverlay` onto the MapLibre map
 * using `react-map-gl`'s `useControl` hook.
 *
 * Must be rendered as a direct child of `<Map>` from `react-map-gl/maplibre`.
 *
 * On mount:
 * - Creates a `MapboxOverlay` instance and registers it as a MapLibre control
 * - Writes the overlay instance to `deckglOverlayAtom` for external access
 *
 * On each render:
 * - Calls `overlay.setProps(props)` to push updated layers to DeckGL
 *
 * On unmount (via `useLayoutEffect` cleanup — fires synchronously before repaint):
 * - Clears layers from the overlay
 * - Calls `overlay.finalize()` to release GPU resources
 * - Clears `deckglOverlayAtom`
 *
 * The `useLayoutEffect` cleanup fires synchronously at unmount, BEFORE the
 * browser paints and before maplibre-gl's ResizeObserver can trigger another
 * render, ensuring DeckGL is finalized before MapLibre tries its last draw call.
 */
export function DeckGLOverlay(props: DeckGLOverlayProps) {
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const setDeckglOverlay = useSetAtom(deckglOverlayAtom);

  const overlay = useControl<MapboxOverlay>(() => {
    const o = new MapboxOverlay(props);
    overlayRef.current = o;
    return o;
  });

  useLayoutEffect(() => {
    setDeckglOverlay(overlayRef.current);

    return () => {
      if (overlayRef.current) {
        try {
          overlayRef.current.setProps({ layers: [] });
          overlayRef.current.finalize();
        } catch {
          // Ignore — overlay may already be in a partial teardown state
        }
        overlayRef.current = null;
      }
      setDeckglOverlay(null);
    };
    // Intentionally empty deps: setup and teardown run once per mount cycle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push latest props (including updated layers) to the overlay on every render
  overlay.setProps(props);

  return null;
}
