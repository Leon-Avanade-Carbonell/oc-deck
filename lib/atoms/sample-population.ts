import { atom } from 'jotai';

interface PopulationFeature {
  type: 'Feature';
  properties: {
    population?: number;
    [key: string]: unknown;
  };
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
}

/**
 * samplePopulationDataAtom
 * Stores the population features (GeoJSON features with geometry and properties)
 */
export const samplePopulationDataAtom = atom<PopulationFeature[]>([]);

/**
 * samplePopulationVisibleAtom
 * Controls the population layer visibility
 */
export const samplePopulationVisibleAtom = atom(true);
