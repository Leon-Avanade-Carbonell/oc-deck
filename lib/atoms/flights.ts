import { atom } from 'jotai';

/** One ingestion run from GET /opensky/requests */
export interface FlightRequest {
  id: string;
  date: string;
  hour: number;
  minute: number;
  window_start_ts: number;
  created_at: string;
  time_ts_count: number;
}

/** A single waypoint in a trip trajectory */
export interface TripWaypoint {
  coordinates: [number, number, number]; // [lon, lat, baro_altitude_metres]
  timestamp: number; // seconds offset from window_start_ts
}

/** One aircraft trip from GET /opensky/trips/{requestId} */
export interface FlightTrip {
  icao24: string;
  callsign: string | null;
  waypoints: TripWaypoint[];
}

// ── Animation state ──────────────────────────────────────────────────────────

/** Current animation time in seconds (offset from window_start_ts). */
export const flightsCurrentTimeAtom = atom(0);

/** Total animation duration in seconds — set when trips are loaded. */
export const flightsMaxTimeAtom = atom(0);

/** Whether the animation is currently playing. */
export const flightsPlayingAtom = atom(false);

/** Playback speed multiplier. 1 = real-time. */
export const flightsSpeedAtom = atom(50);

/** Trail length in seconds. */
export const flightsTrailLengthAtom = atom(250);

/** Loaded trips data. */
export const flightsTripsAtom = atom<FlightTrip[]>([]);

/** Fetch status for trips. */
export const flightsFetchStatusAtom = atom<'idle' | 'loading' | 'ok' | 'error'>('idle');

/** Selected plane (clicked) — screen position + identity. */
export const flightsSelectedAtom = atom<{
  icao24: string;
  callsign: string | null;
  x: number;
  y: number;
} | null>(null);

/** Live altitude map — icao24 → current interpolated altitude in metres.
 *  Written every animation frame by FlightsTripsLayer. */
export const flightsAltMapAtom = atom<Map<string, number>>(new Map());
