import { atom } from 'jotai';
import type { MapboxOverlay } from '@deck.gl/mapbox';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { LayerConfig, BasemapId } from '@/lib/map/types';
import { DEFAULT_BASEMAP } from '@/lib/map/config';

/**
 * The raw MapLibre map instance.
 * Written by `useMapInitialization` when the map mounts, cleared on unmount.
 * Useful for imperative map operations (e.g., fitBounds, flyTo).
 */
export const mapInstanceAtom = atom<MapLibreMap | null>(null);

/**
 * The DeckGL MapboxOverlay instance attached to the map.
 * Written by the internal DeckGLOverlay component, cleared on unmount.
 * Exposed via `useDeckGLOverlay()` for advanced layer access.
 */
export const deckglOverlayAtom = atom<MapboxOverlay | null>(null);

/**
 * Registry of all active layers.
 * Each smart layer adds itself on mount and removes itself on unmount via `useSmartLayer`.
 * BaseMap reads this atom to pass visible layers to DeckGL.
 *
 * Shape: { id, layer, visible, label }[]
 */
export const layersAtom = atom<LayerConfig[]>([]);

/**
 * Currently selected basemap tile identifier.
 * Initialized to the default basemap defined in lib/map/config.ts.
 * Updated by BasemapSelector or directly via useAtom/useSetAtom.
 *
 * To persist across sessions, replace with atomWithStorage from jotai/utils:
 *   export const basemapAtom = atomWithStorage<BasemapId>('basemap', DEFAULT_BASEMAP);
 */
export const basemapAtom = atom<BasemapId>(DEFAULT_BASEMAP);

/**
 * The user's current geographic location as [longitude, latitude].
 * Starts as null (no location known).
 * Populated externally by `useUserLocation` hook (see REVISIT.md).
 * Read by CurrentLocationLayer to position the scatterplot.
 */
export const currentLocationAtom = atom<[number, number] | null>(null);
