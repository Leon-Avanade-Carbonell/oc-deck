'use client';

import { useAtom } from 'jotai';
import { useEffect, useMemo, useRef } from 'react';
import { IconLayer } from '@deck.gl/layers';
import { useSmartLayer } from '@/lib/hooks/useSmartLayer';

import {
  livePlanesDataAtom,
  livePlanesVisibleAtom,
  livePlanesSelectedAtom,
  livePlanesHoveredAtom,
  planesPollIntervalAtom,
  planesRefreshTriggerAtom,
  planesFetchStatusAtom,
  type Plane
} from '@/lib/atoms/live-planes';

const LAYER_ID = 'live-planes';

/** Icon atlas config — single plane sprite pointing north, white for tinting. */
const ICON_ATLAS = '/plane-icon.svg';
const ICON_MAPPING = {
  plane: { x: 0, y: 0, width: 64, height: 64, anchorX: 32, anchorY: 32 }
} as const;

/**
 * Fetches the current aircraft states from the OpenSky Network public API.
 * Returns `{ status, planes }` — never throws, so the caller can handle
 * rate-limiting and errors without crashing the polling loop.
 *
 * @see https://opensky-network.org/apidoc/rest.html#response
 */
async function fetchPlanes(): Promise<
  { status: 'ok'; planes: Plane[] } | { status: 'rate-limited' } | { status: 'error'; message: string }
> {
  let res: Response;
  try {
    res = await fetch('/api/opensky/states/all');
  } catch (err) {
    return { status: 'error', message: String(err) };
  }

  if (res.status === 429) return { status: 'rate-limited' };
  if (!res.ok) return { status: 'error', message: `HTTP ${res.status}` };

  const json = (await res.json()) as {
    states: (string | number | boolean | null)[][] | null;
  };

  const planes = (json.states ?? [])
    .filter(
      (s) =>
        typeof s[5] === 'number' && // longitude
        typeof s[6] === 'number' // latitude
    )
    .map((s) => ({
      icao24: String(s[0]),
      callsign: s[1] ? String(s[1]).trim() : null,
      originCountry: String(s[2]),
      longitude: s[5] as number,
      latitude: s[6] as number,
      baroAltitude: typeof s[7] === 'number' ? s[7] : null,
      onGround: s[8] as boolean,
      velocity: typeof s[9] === 'number' ? s[9] : null,
      trueTrack: typeof s[10] === 'number' ? s[10] : null,
      verticalRate: typeof s[11] === 'number' ? s[11] : null
    }));

  return { status: 'ok', planes };
}

/**
 * LivePlanesLayer
 *
 * Renders all currently airborne aircraft worldwide as dots on the map.
 * Data is fetched from the OpenSky Network public REST API and refreshed
 * every 90 seconds.
 *
 * **Upgrading to IconLayer**: To show plane icons with heading rotation,
 * replace `ScatterplotLayer` with `IconLayer`, add `getAngle: (d) => -(d.trueTrack ?? 0)`,
 * and provide an icon atlas image at `/plane-icon.png`.
 *
 * Data source: https://opensky-network.org/api/states/all
 */
export function LivePlanesLayer() {
  const [data, setData] = useAtom(livePlanesDataAtom);
  const [visible] = useAtom(livePlanesVisibleAtom);
  const [selected, setSelected] = useAtom(livePlanesSelectedAtom);
  const [, setHovered] = useAtom(livePlanesHoveredAtom);
  const [pollInterval] = useAtom(planesPollIntervalAtom);
  const [refreshTrigger] = useAtom(planesRefreshTriggerAtom);
  const [, setFetchStatus] = useAtom(planesFetchStatusAtom);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // Initial fetch + polling. Restarts whenever pollInterval or refreshTrigger changes.
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const result = await fetchPlanes();
      if (cancelled) return;

      if (result.status === 'ok') {
        setData(result.planes);
        setFetchStatus('ok');
      } else if (result.status === 'rate-limited') {
        console.warn('[LivePlanesLayer] Rate limited by OpenSky (429) — retaining existing data');
        setFetchStatus('rate-limited');
      } else {
        console.error('[LivePlanesLayer] Fetch error:', result.message);
        setFetchStatus('error');
      }
    };

    void load();
    intervalRef.current = setInterval(() => void load(), pollInterval * 1_000);

    return () => {
      cancelled = true;
      clearInterval(intervalRef.current);
    };
  }, [setData, setFetchStatus, pollInterval, refreshTrigger]);

  const layer = useMemo(
    () =>
      new IconLayer<Plane>({
        id: LAYER_ID,
        data: visible ? data : [],
        iconAtlas: ICON_ATLAS,
        iconMapping: ICON_MAPPING,
        getIcon: () => 'plane',
        getPosition: (d) => [d.longitude, d.latitude],
        getSize: (d) => (selected?.icao24 === d.icao24 ? 28 : 20),
        sizeUnits: 'pixels',
        // DeckGL angle is counter-clockwise; trueTrack is clockwise from north → negate
        getAngle: (d) => -(d.trueTrack ?? 0),
        getColor: (d) => {
          // Green for planes on the ground
          if (d.onGround) return [0, 200, 80, 220];
          // Yellow → orange → red based on absolute vertical rate.
          // Normalised against 25 m/s (~4900 ft/min), a high-performance climb rate.
          const rate = Math.abs(d.verticalRate ?? 0);
          const t = Math.min(rate / 25, 1); // 0 = slow/level, 1 = fast climb/descent
          const g = Math.round(255 * (1 - t));
          return [255, g, 0, 220]; // [255,255,0] yellow → [255,0,0] red
        },
        pickable: true,
        onHover: (info) => {
          setHovered(info.object ? { plane: info.object, x: info.x, y: info.y } : null);
        },
        onClick: (info) => {
          if (info.object) {
            setSelected((prev) => (prev?.icao24 === info.object.icao24 ? null : info.object));
          }
        },
        updateTriggers: {
          getColor: [data],
          getSize: [selected],
          getAngle: [data]
        }
      }),
    [data, visible, selected, setSelected, setHovered]
  );

  useSmartLayer({ id: LAYER_ID, layer, label: 'Live Planes' });

  return null;
}
