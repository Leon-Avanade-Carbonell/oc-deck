'use client';

import { useAtom } from 'jotai';
import { useEffect, useMemo, useRef } from 'react';
import { ScatterplotLayer } from '@deck.gl/layers';
import { useSmartLayer } from '@/lib/hooks/useSmartLayer';

import {
  livePlanesDataAtom,
  livePlanesVisibleAtom,
  livePlanesSelectedAtom,
  type Plane,
} from '@/lib/atoms/live-planes';

const LAYER_ID = 'live-planes';
const POLL_INTERVAL_MS = 90_000;

/**
 * Fetches the current aircraft states from the OpenSky Network public API.
 * Returns a flat array of {@link Plane} objects, filtering out any aircraft
 * with missing position data or that are on the ground.
 *
 * @see https://opensky-network.org/apidoc/rest.html#response
 */
async function fetchPlanes(): Promise<Plane[]> {
  const res = await fetch('/api/opensky/states/all');
  if (!res.ok) throw new Error(`OpenSky API error: ${res.status}`);

  const json = (await res.json()) as {
    states: (string | number | boolean | null)[][] | null;
  };

  if (!json.states) return [];

  return json.states
    .filter(
      (s) =>
        typeof s[5] === 'number' && // longitude
        typeof s[6] === 'number' && // latitude
        s[8] === false // not on ground
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
      verticalRate: typeof s[11] === 'number' ? s[11] : null,
    }));
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
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // Initial fetch + polling every 90 seconds
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const planes = await fetchPlanes();
        if (!cancelled) setData(planes);
      } catch (err) {
        console.error('[LivePlanesLayer] Failed to fetch plane data:', err);
      }
    };

    void load();
    intervalRef.current = setInterval(() => void load(), POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalRef.current);
    };
  }, [setData]);

  const layer = useMemo(
    () =>
      new ScatterplotLayer<Plane>({
        id: LAYER_ID,
        data: visible ? data : [],
        getPosition: (d) => [d.longitude, d.latitude],
        getRadius: (d) =>
          selected && d.icao24 === selected.icao24 ? 8 : 4,
        radiusUnits: 'pixels',
        getFillColor: (d) =>
          selected && d.icao24 === selected.icao24
            ? [255, 140, 0, 255]   // orange highlight for selected
            : [30, 144, 255, 200], // dodger-blue for all others
        getLineColor: [255, 255, 255, 180],
        stroked: true,
        lineWidthMinPixels: 1,
        pickable: true,
        onClick: (info) => {
          if (info.object) {
            // Toggle selection: click same plane again to deselect
            setSelected((prev) =>
              prev?.icao24 === info.object.icao24 ? null : info.object
            );
          }
        },
        updateTriggers: {
          getFillColor: [selected],
          getRadius: [selected],
        },
      }),
    [data, visible, selected, setSelected]
  );

  useSmartLayer({ id: LAYER_ID, layer, label: 'Live Planes' });

  return null;
}
