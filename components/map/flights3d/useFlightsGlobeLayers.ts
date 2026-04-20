'use client';

import { useAtom, useSetAtom } from 'jotai';
import { useEffect, useMemo, useRef } from 'react';
import { TripsLayer } from '@deck.gl/geo-layers';
import { IconLayer, LineLayer } from '@deck.gl/layers';
import type { Layer } from '@deck.gl/core';
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

const TRIPS_LAYER_ID = 'flights-trips-globe';
const ICONS_LAYER_ID = 'flights-icons-globe';
const DROPS_LAYER_ID = 'flights-drops-globe';

const ICON_ATLAS = '/plane-icon.svg';
const ICON_MAPPING = {
  plane: { x: 0, y: 0, width: 64, height: 64, anchorX: 32, anchorY: 32 }
} as const;

type RGBAColor = [number, number, number, number];

/**
 * Maps vertical rate (m/s) to an RGBA colour.
 *   green = climbing, gray = level, red = descending
 */
function verticalRateToColor(rate: number, alpha = 220): RGBAColor {
  const CLAMP = 5;
  const t = Math.max(-1, Math.min(1, rate / CLAMP));
  if (t >= 0) {
    const r = Math.round(160 * (1 - t));
    const g = Math.round(160 + 95 * t);
    const b = Math.round(160 * (1 - t));
    return [r, g, b, alpha];
  } else {
    const abs = -t;
    const r = Math.round(160 + 95 * abs);
    const g = Math.round(160 * (1 - abs));
    const b = Math.round(160 * (1 - abs));
    return [r, g, b, alpha];
  }
}

function lerpN(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function computeBearing(from: [number, number, number], to: [number, number, number]): number {
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
  /** Raw altitude in metres — used directly as Z on the globe. */
  position: [number, number, number];
  heading: number;
  altitude: number;
  verticalRate: number;
}

function computePositions(trips: FlightTrip[], currentTime: number): PlanePosition[] {
  const result: PlanePosition[] = [];
  for (const trip of trips) {
    const wps = trip.waypoints;
    if (wps.length < 2) continue;
    const first = wps[0];
    const last = wps[wps.length - 1];
    if (currentTime < first.timestamp || currentTime > last.timestamp) continue;

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
    const verticalRate = span > 0 ? (b.coordinates[2] - a.coordinates[2]) / span : 0;

    result.push({
      icao24: trip.icao24,
      callsign: trip.callsign,
      // Raw altitude metres as Z — correct for _GlobeView which uses WGS84 metres
      position: [lerpN(a.coordinates[0], b.coordinates[0], t), lerpN(a.coordinates[1], b.coordinates[1], t), alt],
      heading: computeBearing(a.coordinates, b.coordinates),
      altitude: alt,
      verticalRate
    });
  }
  return result;
}

/**
 * useFlightsGlobeLayers
 *
 * Manages fetch, animation loop, and layer construction for the globe flights map.
 * Returns a stable array of DeckGL Layer instances to pass directly to a <DeckGL> component.
 *
 * Key differences from FlightsTrips3DLayer:
 * - Raw altitude metres as Z (no ALTITUDE_SCALE) — correct for _GlobeView
 * - No mapBearing compensation — _GlobeView has no camera bearing
 * - Returns layers directly instead of registering via useSmartLayer
 */
export function useFlightsGlobeLayers(requestId: string): Layer[] {
  const [trips, setTrips] = useAtom(flightsTripsAtom);
  const [currentTime, setCurrentTime] = useAtom(flightsCurrentTimeAtom);
  const [maxTime, setMaxTime] = useAtom(flightsMaxTimeAtom);
  const [playing] = useAtom(flightsPlayingAtom);
  const [speed] = useAtom(flightsSpeedAtom);
  const [trailLength] = useAtom(flightsTrailLengthAtom);
  const [, setFetchStatus] = useAtom(flightsFetchStatusAtom);
  const [, setSelected] = useAtom(flightsSelectedAtom);
  const setAltMap = useSetAtom(flightsAltMapAtom);

  // ── Fetch ────────────────────────────────────────────────────────────────────
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
          console.error('[useFlightsGlobeLayers] Fetch error:', err);
          setFetchStatus('error');
        }
        return;
      }
      if (!res.ok) {
        if (!cancelled) {
          console.error('[useFlightsGlobeLayers] HTTP', res.status);
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

  // ── Animation loop ───────────────────────────────────────────────────────────
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

  // ── Positions ────────────────────────────────────────────────────────────────
  const positions = useMemo(() => computePositions(trips, currentTime), [trips, currentTime]);

  useEffect(() => {
    const m = new Map<string, number>();
    for (const p of positions) m.set(p.icao24, p.altitude);
    setAltMap(m);
  }, [positions, setAltMap]);

  // ── Layers ───────────────────────────────────────────────────────────────────
  const tripsLayer = useMemo(
    () =>
      new TripsLayer<FlightTrip>({
        id: TRIPS_LAYER_ID,
        data: trips,
        // Raw altitude metres as Z — _GlobeView interprets Z as metres above WGS84
        getPath: (d) => d.waypoints.map((wp) => wp.coordinates),
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
        // No bearing compensation — _GlobeView has no camera bearing rotation
        getAngle: (d) => -d.heading,
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
          getAngle: [positions],
          getColor: [positions]
        }
      }),
    [positions, setSelected]
  );

  const dropsLayer = useMemo(
    () =>
      new LineLayer<PlanePosition>({
        id: DROPS_LAYER_ID,
        data: positions,
        getSourcePosition: (d) => d.position,
        getTargetPosition: (d) => [d.position[0], d.position[1], 0],
        getColor: (d) => verticalRateToColor(d.verticalRate, 140),
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

  return [tripsLayer, dropsLayer, iconsLayer];
}
