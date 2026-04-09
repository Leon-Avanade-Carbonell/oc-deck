import type { BasemapId, MapControls, MapViewport } from './types';

/**
 * Default basemap shown on initial load.
 * Must match a key in BASETILES (lib/map/basetiles.ts).
 */
export const DEFAULT_BASEMAP: BasemapId = 'positron';

/**
 * Default map viewport centered on Adelaide CBD, Australia.
 * Override per-instance via the `initialViewport` prop on BaseMap.
 */
export const DEFAULT_VIEWPORT: MapViewport = {
  center: [138.6007, -34.9285],
  zoom: 12,
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
