'use client';

import { useAtom } from 'jotai';
import { useEffect, useMemo, useRef } from 'react';
import { TripsLayer } from '@deck.gl/geo-layers';
import { IconLayer } from '@deck.gl/layers';
import { useSmartLayer } from '@/lib/hooks/useSmartLayer';
import {
  flightsTripsAtom,
  flightsCurrentTimeAtom,
  flightsMaxTimeAtom,
  flightsPlayingAtom,
  flightsSpeedAtom,
  flightsTrailLengthAtom,
  flightsFetchStatusAtom,
  flightsSelectedAtom,
  flightsAltMapAtom,  type FlightTrip,
  type TripWaypoint,
} from '@/lib/atoms/flights';

const TRIPS_LAYER_ID = 'flights-trips';
const ICONS_LAYER_ID = 'flights-icons';

const ICON_ATLAS = '/plane-icon.svg';
const ICON_MAPPING = {
  plane: { x: 0, y: 0, width: 64, height: 64, anchorX: 32, anchorY: 32 },
} as const;

type RGBAColor = [number, number, number, number];

/**
 * Maps barometric altitude (metres) to an RGBA colour using 4 stops.
 *
 * Stops are deliberately compressed at the low end so that takeoff and
 * landing phases (0–1 500 m) produce vivid, rapid colour changes:
 *
 *      0 m  → green  [0, 200, 80]   ground / taxi
 *  1 500 m  → yellow [255, 220, 0]  initial climb / final approach (~5 000 ft)
 *  4 000 m  → orange [255, 100, 0]  climb / descent transition (~13 000 ft)
 * 10 000 m+ → blue   [30, 144, 255] cruise (~33 000 ft)
 */
function altitudeToColor(altMetres: number, alpha = 220): RGBAColor {
  // [altitude_metres, r, g, b]
  const STOPS: [number, number, number, number][] = [
    [0,      0,   200,  80],
    [1_500,  255, 220,   0],
    [4_000,  255, 100,   0],
    [10_000, 30,  144, 255],
  ];

  const alt = Math.max(altMetres, 0);

  // Above max stop → clamp to last colour
  if (alt >= STOPS[STOPS.length - 1][0]) {
    const s = STOPS[STOPS.length - 1];
    return [s[1], s[2], s[3], alpha];
  }

  // Find bracketing stops
  for (let i = 0; i < STOPS.length - 1; i++) {
    const [a0, r0, g0, b0] = STOPS[i];
    const [a1, r1, g1, b1] = STOPS[i + 1];
    if (alt <= a1) {
      const t = (alt - a0) / (a1 - a0);
      return [
        Math.round(r0 + (r1 - r0) * t),
        Math.round(g0 + (g1 - g0) * t),
        Math.round(b0 + (b1 - b0) * t),
        alpha,
      ];
    }
  }

  // Fallback (unreachable)
  return [30, 144, 255, alpha];
}

interface FlightsTripsLayerProps {
  requestId: string;
}

function lerpN(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Compute bearing in degrees (CW from north) between two [lon, lat] points.
 */
function bearing(from: [number, number, number], to: [number, number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const dLon = toRad(to[0] - from[0]);
  const lat1 = toRad(from[1]);
  const lat2 = toRad(to[1]);
  const x = Math.sin(dLon) * Math.cos(lat2);
  const y = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(x, y)) + 360) % 360;
}

interface PlanePosition {
  icao24: string;
  callsign: string | null;
  position: [number, number, number]; // [lon, lat, alt]
  heading: number;
  altitude: number; // metres
}

/**
 * Interpolate each aircraft's position and altitude at `currentTime`.
 * Aircraft outside their window are omitted.
 */
function computePositions(trips: FlightTrip[], currentTime: number): PlanePosition[] {
  const result: PlanePosition[] = [];

  for (const trip of trips) {
    const wps = trip.waypoints;
    if (wps.length < 2) continue;

    const first = wps[0];
    const last  = wps[wps.length - 1];
    if (currentTime < first.timestamp || currentTime > last.timestamp) continue;

    // Binary search for bracketing waypoints
    let lo = 0;
    let hi = wps.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (wps[mid].timestamp <= currentTime) lo = mid;
      else hi = mid;
    }

    const a: TripWaypoint = wps[lo];
    const b: TripWaypoint = wps[hi];
    const span = b.timestamp - a.timestamp;
    const t    = span > 0 ? (currentTime - a.timestamp) / span : 0;

    const alt = lerpN(a.coordinates[2], b.coordinates[2], t);

    result.push({
      icao24: trip.icao24,
      callsign: trip.callsign,
      position: [
        lerpN(a.coordinates[0], b.coordinates[0], t),
        lerpN(a.coordinates[1], b.coordinates[1], t),
        alt,
      ],
      heading: bearing(a.coordinates, b.coordinates),
      altitude: alt,
    });
  }

  return result;
}

/**
 * FlightsTripsLayer
 *
 * Renders:
 *   1. TripsLayer  — animated trails coloured by current altitude per aircraft.
 *   2. IconLayer   — plane icon at interpolated position, same altitude colour.
 *
 * Both layers update colour every animation frame via updateTriggers keyed to
 * the `positions` array (which changes every frame during playback).
 */
export function FlightsTripsLayer({ requestId }: FlightsTripsLayerProps) {
  const [trips, setTrips]           = useAtom(flightsTripsAtom);
  const [currentTime, setCurrentTime] = useAtom(flightsCurrentTimeAtom);
  const [maxTime, setMaxTime]       = useAtom(flightsMaxTimeAtom);
  const [playing]                   = useAtom(flightsPlayingAtom);
  const [speed]                     = useAtom(flightsSpeedAtom);
  const [trailLength]               = useAtom(flightsTrailLengthAtom);
  const [, setFetchStatus]          = useAtom(flightsFetchStatusAtom);
  const [, setSelected]             = useAtom(flightsSelectedAtom);
  const [, setAltMap]               = useAtom(flightsAltMapAtom);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!requestId) return;
    let cancelled = false;
    setFetchStatus('loading');

    const load = async () => {
      let res: Response;
      try {
        res = await fetch(`/api/flights/trips/${requestId}`);
      } catch (err) {
        if (!cancelled) { console.error('[FlightsTripsLayer] Fetch error:', err); setFetchStatus('error'); }
        return;
      }
      if (!res.ok) {
        if (!cancelled) { console.error('[FlightsTripsLayer] HTTP', res.status); setFetchStatus('error'); }
        return;
      }
      const data = (await res.json()) as FlightTrip[];
      if (cancelled) return;

      setTrips(data);
      setFetchStatus('ok');

      let max = 0;
      for (const trip of data)
        for (const wp of trip.waypoints)
          if (wp.timestamp > max) max = wp.timestamp;
      setMaxTime(max);
      setCurrentTime(0);
    };

    void load();
    return () => { cancelled = true; };
  }, [requestId, setTrips, setMaxTime, setCurrentTime, setFetchStatus]);

  // ── Animation loop ─────────────────────────────────────────────────────────
  const rafRef      = useRef<number>(undefined);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    const animate = (now: number) => {
      const delta = lastTimeRef.current ? (now - lastTimeRef.current) / 1000 : 0;
      lastTimeRef.current = now;
      setCurrentTime((prev) => {
        const next = prev + delta * speed;
        return next >= maxTime ? 0 : next;
      });
      rafRef.current = requestAnimationFrame(animate);
    };

    lastTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, maxTime, setCurrentTime]);

  // ── Interpolated positions (recomputed each frame during playback) ─────────
  const positions = useMemo(
    () => computePositions(trips, currentTime),
    [trips, currentTime]
  );

  // Publish live altitudes to atom so other components (e.g. tooltip) can read them
  useEffect(() => {
    const m = new Map<string, number>();
    for (const p of positions) m.set(p.icao24, p.altitude);
    setAltMap(m);
  }, [positions, setAltMap]);

  // icao24 → altitude map for fast lookup inside TripsLayer getColor
  const altMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of positions) m.set(p.icao24, p.altitude);
    return m;
  }, [positions]);

  // ── Layers ─────────────────────────────────────────────────────────────────
  const tripsLayer = useMemo(
    () =>
      new TripsLayer<FlightTrip>({
        id: TRIPS_LAYER_ID,
        data: trips,
        getPath: (d) => d.waypoints.map((wp) => wp.coordinates),
        getTimestamps: (d) => d.waypoints.map((wp) => wp.timestamp),
        getColor: (d) => altitudeToColor(altMap.get(d.icao24) ?? 0),
        opacity: 0.9,
        widthMinPixels: 2,
        rounded: true,
        trailLength,
        currentTime,
        updateTriggers: {
          getColor: [altMap],
        },
      }),
    // altMap + currentTime + trailLength drive updates
    [trips, trailLength, currentTime, altMap]
  );

  const iconsLayer = useMemo(
    () =>
      new IconLayer<PlanePosition>({
        id: ICONS_LAYER_ID,
        data: positions,
        iconAtlas: ICON_ATLAS,
        iconMapping: ICON_MAPPING,
        getIcon: () => 'plane',
        getPosition: (d) => d.position,
        getSize: 20,
        sizeUnits: 'pixels',
        getAngle: (d) => -d.heading,
        getColor: [253, 200, 160, 230], // fixed warm white — tinting unreliable with SVG atlas
        pickable: true,
        onClick: (info) => {
          setSelected(
            info.object
              ? { icao24: info.object.icao24, callsign: info.object.callsign, x: info.x, y: info.y }
              : null
          );
        },
        updateTriggers: {
          getPosition: [positions],
          getAngle:    [positions],
        },
      }),
    [positions]
  );

  useSmartLayer({ id: TRIPS_LAYER_ID, layer: tripsLayer, label: 'Flight Trails', order: 0 });
  useSmartLayer({ id: ICONS_LAYER_ID, layer: iconsLayer, label: 'Flight Icons',  order: 1 });

  return null;
}
