import { atom } from 'jotai';

/**
 * Represents a single aircraft from the OpenSky Network API.
 * Source: https://opensky-network.org/apidoc/rest.html#response
 */
export interface Plane {
  icao24: string;
  callsign: string | null;
  originCountry: string;
  longitude: number;
  latitude: number;
  baroAltitude: number | null;
  onGround: boolean;
  velocity: number | null;
  /** True track in decimal degrees clockwise from north (0–360). */
  trueTrack: number | null;
  verticalRate: number | null;
}

/**
 * livePlanesDataAtom
 * Stores the current array of tracked aircraft from OpenSky Network.
 * Updated every 90 seconds by the LivePlanesLayer component.
 */
export const livePlanesDataAtom = atom<Plane[]>([]);

/**
 * livePlanesVisibleAtom
 * Controls visibility of the live planes layer.
 */
export const livePlanesVisibleAtom = atom(true);

/**
 * livePlanesSelectedAtom
 * Stores the currently selected aircraft (clicked on the map).
 * Null when nothing is selected.
 */
export const livePlanesSelectedAtom = atom<Plane | null>(null);
