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

/**
 * livePlanesHoveredAtom
 * Stores the currently hovered aircraft and its screen-space position.
 * Null when the cursor is not over any plane.
 */
export const livePlanesHoveredAtom = atom<{
  plane: Plane;
  x: number;
  y: number;
} | null>(null);

/**
 * planesPollIntervalAtom
 * Controls how often (in seconds) the live planes data is refreshed.
 * Range: 10–300 seconds. Default: 90 seconds.
 */
export const planesPollIntervalAtom = atom(90);

/**
 * planesRefreshTriggerAtom
 * Incrementing this atom causes LivePlanesLayer to immediately fetch fresh
 * data and reset its polling interval. Write-only from UI components.
 */
export const planesRefreshTriggerAtom = atom(0);

/**
 * planesFetchStatusAtom
 * Reflects the result of the most recent fetch attempt.
 * 'ok'           — last fetch succeeded
 * 'rate-limited' — last fetch was rejected with HTTP 429
 * 'error'        — last fetch failed for another reason
 */
export const planesFetchStatusAtom = atom<'ok' | 'rate-limited' | 'error' | null>(null);
