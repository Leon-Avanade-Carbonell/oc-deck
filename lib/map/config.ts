import type { BasemapId, MapControls, MapViewport } from './types';

/**
 * Default basemap shown on initial load.
 * Must match a key in BASETILES (lib/map/basetiles.ts).
 */
export const DEFAULT_BASEMAP: BasemapId = 'positron';

/**
 * Default map viewport centered on Australia.
 * Override per-instance via the `initialViewport` prop on BaseMap.
 */
export const DEFAULT_VIEWPORT: MapViewport = {
  center: [133.7751, -25.2744],
  zoom: 3.5,
  pitch: 0,
  bearing: 0
};

/**
 * Default map interaction controls.
 * Pan and zoom are enabled; rotate and pitch are disabled by default.
 */
export const DEFAULT_CONTROLS: MapControls = {
  pan: true,
  zoom: true,
  rotate: false,
  pitch: false
};
