import type { BasemapId } from './types';

/**
 * Definition of a single basemap tile option.
 */
export interface BasemapDefinition {
  id: BasemapId;
  /** Human-readable label shown in BasemapSelector */
  name: string;
  /** MapLibre GL Style Spec compliant style.json URL */
  url: string;
}

/**
 * Registry of all available basemap tiles.
 * All styles are based on OpenStreetMap data via CartoDB.
 *
 * To add a new basemap:
 * 1. Add a new key to the `BasemapId` union in lib/map/types.ts
 * 2. Add the corresponding entry here with a valid MapLibre style URL
 */
export const BASETILES: Record<BasemapId, BasemapDefinition> = {
  positron: {
    id: 'positron',
    name: 'Positron',
    url: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
  },
  'dark-matter': {
    id: 'dark-matter',
    name: 'Dark Matter',
    url: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
  },
  voyager: {
    id: 'voyager',
    name: 'Voyager',
    url: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'
  }
};

/**
 * Ordered list of all basemap options for rendering in selectors.
 */
export const BASETILES_LIST: BasemapDefinition[] = Object.values(BASETILES);
