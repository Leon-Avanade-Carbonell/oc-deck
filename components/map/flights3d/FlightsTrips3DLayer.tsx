'use client';

import { useAtom, useAtomValue } from 'jotai';
import { useEffect, useMemo, useRef } from 'react';
import { TripsLayer } from '@deck.gl/geo-layers';
import { IconLayer, LineLayer } from '@deck.gl/layers';
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
  flightsAltMapAtom,
  type FlightTrip,
  type TripWaypoint
} from '@/lib/atoms/flights';
import { mapBearingAtom } from '@/lib/atoms/map';

const TRIPS_LAYER_ID = 'flights-trips-3d';
const ICONS_LAYER_ID = 'flights-icons-3d';
const DROPS_LAYER_ID = 'flights-drops-3d';

const ICON_ATLAS = '/plane-icon.svg';
const ICON_MAPPING = {
  plane: { x: 0, y: 0, width: 64, height: 64, anchorX: 32, anchorY: 32 }
} as const;

/**
 * Altitude scale factor. Raw metres are too large to be visually useful at
 * typical map zoom levels — this brings cruise altitude (~10 000 m) to a
 * satisfying visual height above the city at zoom 12.
 */
const ALTITUDE_SCALE = 0.05;

type RGBAColor = [number, number, number, number];

/**
 * Maps vertical rate (m/s) to an RGBA colour.
 *
 *  < -2 m/s  → red    (descending)
 *    0 m/s   → gray   (level)
 *  > +2 m/s  → green  (climbing)
 *
 * Values are clamped to the ±5 m/s range.
 */
function verticalRateToColor(rate: number, alpha = 220): RGBAColor {
  const CLAMP = 5;
  const t = Math.max(-1, Math.min(1, rate / CLAMP)); // -1 → +1

  if (t >= 0) {
    // level (gray) → climbing (green)
    const r = Math.round(160 * (1 - t));
    const g = Math.round(160 + 95 * t); // 160 → 255
    const b = Math.round(160 * (1 - t));
    return [r, g, b, alpha];
  } else {
    // descending (red) → level (gray)
    const abs = -t;
    const r = Math.round(160 + 95 * abs); // 160 → 255
    const g = Math.round(160 * (1 - abs));
    const b = Math.round(160 * (1 - abs));
    return [r, g, b, alpha];
  }
}

interface FlightsTrips3DLayerProps {
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
  /** Scaled position for rendering: [lon, lat, alt * ALTITUDE_SCALE] */
  position: [number, number, number];
  heading: number;
  /** Raw altitude in metres (unscaled) — for tooltip display */
  altitude: number;
  /** Derived vertical rate in m/s — positive = climbing */
  verticalRate: number;
}

/**
 * Interpolate each aircraft's position, altitude, and vertical rate at
 * `currentTime`. Aircraft outside their window are omitted.
 *
 * Vertical rate is derived from the altitude delta between the bracketing
 * waypoints divided by their time span (m/s).
 */
function computePositions(trips: FlightTrip[], currentTime: number): PlanePosition[] {
  const result: PlanePosition[] = [];

  for (const trip of trips) {
    const wps = trip.waypoints;
    if (wps.length < 2) continue;

    const first = wps[0];
    const last = wps[wps.length - 1];
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
    const t = span > 0 ? (currentTime - a.timestamp) / span : 0;

    const alt = lerpN(a.coordinates[2], b.coordinates[2], t);

    // Vertical rate: altitude delta / time delta (m/s)
    const verticalRate = span > 0 ? (b.coordinates[2] - a.coordinates[2]) / span : 0;

    result.push({
      icao24: trip.icao24,
      callsign: trip.callsign,
      position: [
        lerpN(a.coordinates[0], b.coordinates[0], t),
        lerpN(a.coordinates[1], b.coordinates[1], t),
        alt * ALTITUDE_SCALE
      ],
      heading: bearing(a.coordinates, b.coordinates),
      altitude: alt,
      verticalRate
    });
  }

  return result;
}

/**
 * FlightsTrips3DLayer
 *
 * 3D variant of FlightsTripsLayer. Renders:
 *   1. TripsLayer  — animated trails with scaled altitude as Z coordinate.
 *   2. IconLayer   — plane icon floating at scaled altitude above the map.
 *   3. LineLayer   — vertical drop line from each plane down to ground level.
 *
 * Icon and drop line colour encodes vertical rate:
 *   green = climbing, gray = level, red = descending.
 *
 * Uses separate layer IDs from FlightsTripsLayer so both can coexist if needed.
 */
export function FlightsTrips3DLayer({ requestId }: FlightsTrips3DLayerProps) {
  const [trips, setTrips] = useAtom(flightsTripsAtom);
  const [currentTime, setCurrentTime] = useAtom(flightsCurrentTimeAtom);
  const [maxTime, setMaxTime] = useAtom(flightsMaxTimeAtom);
  const [playing] = useAtom(flightsPlayingAtom);
  const [speed] = useAtom(flightsSpeedAtom);
  const [trailLength] = useAtom(flightsTrailLengthAtom);
  const [, setFetchStatus] = useAtom(flightsFetchStatusAtom);
  const [, setSelected] = useAtom(flightsSelectedAtom);
  const [, setAltMap] = useAtom(flightsAltMapAtom);
  const mapBearing = useAtomValue(mapBearingAtom);

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
        if (!cancelled) {
          console.error('[FlightsTrips3DLayer] Fetch error:', err);
          setFetchStatus('error');
        }
        return;
      }
      if (!res.ok) {
        if (!cancelled) {
          console.error('[FlightsTrips3DLayer] HTTP', res.status);
          setFetchStatus('error');
        }
        return;
      }
      const data = (await res.json()) as FlightTrip[];
      if (cancelled) return;

      setTrips(data);
      setFetchStatus('ok');

      let max = 0;
      for (const trip of data) for (const wp of trip.waypoints) if (wp.timestamp > max) max = wp.timestamp;
      setMaxTime(max);
      setCurrentTime(0);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [requestId, setTrips, setMaxTime, setCurrentTime, setFetchStatus]);

  // ── Animation loop ─────────────────────────────────────────────────────────
  const rafRef = useRef<number>(undefined);
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
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, speed, maxTime, setCurrentTime]);

  // ── Interpolated positions ─────────────────────────────────────────────────
  const positions = useMemo(() => computePositions(trips, currentTime), [trips, currentTime]);

  // Publish live altitudes to atom so tooltip can read them
  useEffect(() => {
    const m = new Map<string, number>();
    for (const p of positions) m.set(p.icao24, p.altitude);
    setAltMap(m);
  }, [positions, setAltMap]);

  // ── Trips layer — trails with scaled Z ─────────────────────────────────────
  const tripsLayer = useMemo(
    () =>
      new TripsLayer<FlightTrip>({
        id: TRIPS_LAYER_ID,
        data: trips,
        // Scale altitude on each waypoint coordinate for the trail
        getPath: (d) =>
          d.waypoints.map(
            (wp) =>
              [wp.coordinates[0], wp.coordinates[1], wp.coordinates[2] * ALTITUDE_SCALE] as [number, number, number]
          ),
        getTimestamps: (d) => d.waypoints.map((wp) => wp.timestamp),
        getColor: [180, 200, 255, 180],
        opacity: 0.8,
        widthMinPixels: 2,
        rounded: true,
        trailLength,
        currentTime
      }),
    [trips, trailLength, currentTime]
  );

  // ── Icons layer — plane floating at altitude ───────────────────────────────
  const iconsLayer = useMemo(
    () =>
      new IconLayer<PlanePosition>({
        id: ICONS_LAYER_ID,
        data: positions,
        iconAtlas: ICON_ATLAS,
        iconMapping: ICON_MAPPING,
        getIcon: () => 'plane',
        getPosition: (d) => d.position,
        getSize: 24,
        sizeUnits: 'pixels',
        // Subtract map bearing so the heading stays geographically correct
        // as the user rotates the map. billboard: true keeps the icon
        // always facing the camera (readable at any pitch angle).
        getAngle: (d) => -(d.heading - mapBearing),
        getColor: (d) => verticalRateToColor(d.verticalRate),
        pickable: true,
        billboard: true,
        onClick: (info) => {
          setSelected(
            info.object ? { icao24: info.object.icao24, callsign: info.object.callsign, x: info.x, y: info.y } : null
          );
        },
        updateTriggers: {
          getPosition: [positions],
          getAngle: [positions, mapBearing],
          getColor: [positions]
        }
      }),
    [positions, mapBearing, setSelected]
  );

  // ── Drop lines — vertical line from plane to ground ────────────────────────
  const dropsLayer = useMemo(
    () =>
      new LineLayer<PlanePosition>({
        id: DROPS_LAYER_ID,
        data: positions,
        getSourcePosition: (d) => d.position,
        getTargetPosition: (d) => [d.position[0], d.position[1], 0],
        getColor: (d) => {
          const c = verticalRateToColor(d.verticalRate, 140);
          return c;
        },
        getWidth: 1,
        widthUnits: 'pixels',
        updateTriggers: {
          getSourcePosition: [positions],
          getTargetPosition: [positions],
          getColor: [positions]
        }
      }),
    [positions]
  );

  useSmartLayer({ id: TRIPS_LAYER_ID, layer: tripsLayer, label: 'Flight Trails 3D', order: 0 });
  useSmartLayer({ id: DROPS_LAYER_ID, layer: dropsLayer, label: 'Flight Drop Lines', order: 1 });
  useSmartLayer({ id: ICONS_LAYER_ID, layer: iconsLayer, label: 'Flight Icons 3D', order: 2 });

  return null;
}
