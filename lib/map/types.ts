import type { Layer } from '@deck.gl/core';

/**
 * A single registered layer entry stored in `layersAtom`.
 * Each smart layer component is responsible for adding/updating/removing its own entry.
 */
export interface LayerConfig {
  /** Unique identifier for this layer — must be stable across renders */
  id: string;
  /** The DeckGL layer instance to render */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  layer: Layer<any>;
  /** Whether this layer is currently visible */
  visible: boolean;
  /** Human-readable label shown in layer control UIs */
  label: string;
  /** Stacking order — higher values render on top. Layers are sorted by this before rendering. */
  order?: number;
}

/**
 * Map interaction controls that can be enabled or disabled on BaseMap.
 */
export interface MapControls {
  /** Allow dragging to pan */
  pan?: boolean;
  /** Allow scroll/pinch to zoom */
  zoom?: boolean;
  /** Allow right-click drag or two-finger to rotate */
  rotate?: boolean;
  /** Allow pitch (tilt) gesture */
  pitch?: boolean;
}

/**
 * Initial viewport state passed to BaseMap.
 */
export interface MapViewport {
  /** [longitude, latitude] center of the map */
  center: [number, number];
  /** Zoom level (0–22) */
  zoom: number;
  /** Camera pitch in degrees (0 = flat, 60 = tilted) */
  pitch?: number;
  /** Map bearing/rotation in degrees */
  bearing?: number;
}

/**
 * Available basemap tile identifiers.
 * Maps to entries in `lib/map/basetiles.ts`.
 */
export type BasemapId = 'positron' | 'dark-matter' | 'voyager';
