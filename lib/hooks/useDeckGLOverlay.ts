'use client';

import { useAtomValue } from 'jotai';
import { deckglOverlayAtom } from '@/lib/atoms/map';
import type { MapboxOverlay } from '@deck.gl/mapbox';

/**
 * Returns the DeckGL `MapboxOverlay` instance currently attached to the map,
 * or `null` if the overlay has not yet been initialized.
 *
 * The overlay instance is written to `deckglOverlayAtom` by the internal
 * `DeckGLOverlay` component inside BaseMap.
 *
 * Use this hook for advanced DeckGL operations that are not covered by the
 * standard layer pattern (e.g., picking, custom effects). For most layer use
 * cases, prefer `useSmartLayer` instead.
 *
 * Example:
 * ```ts
 * const overlay = useDeckGLOverlay();
 * const picked = overlay?.pickObject({ x, y, radius: 10 });
 * ```
 */
export function useDeckGLOverlay(): MapboxOverlay | null {
  return useAtomValue(deckglOverlayAtom);
}
