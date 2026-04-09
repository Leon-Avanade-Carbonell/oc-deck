import { atom } from 'jotai';

export interface HexCell {
  id: string;
  population: number;
  geometry: [number, number][]; // GeoJSON coordinates [lon, lat][]
}

export interface SelectedHex {
  hexId: string;
  population: number;
  x: number; // Screen pixel X
  y: number; // Screen pixel Y
}

/**
 * Stores the current hex data (filtered by zoom level and Australia bounds)
 */
export const sampleHexDataAtom = atom<HexCell[]>([]);

/**
 * Stores the currently selected hex for tooltip display
 * null = no hex selected
 */
export const sampleSelectedHexAtom = atom<SelectedHex | null>(null);

/**
 * Controls visibility of the sample hex layer
 */
export const sampleHexLayerVisibleAtom = atom<boolean>(false);
