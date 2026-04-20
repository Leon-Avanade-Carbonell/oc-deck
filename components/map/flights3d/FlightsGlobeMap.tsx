'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import DeckGL from '@deck.gl/react';
import { useHydrationAware } from '@/lib/hooks/useHydrationAware';
import { _GlobeView, type GlobeViewState } from '@deck.gl/core';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer } from '@deck.gl/layers';
import type { GeoBoundingBox } from '@deck.gl/geo-layers';
import { useFlightsGlobeLayers } from './useFlightsGlobeLayers';
import { Flights3DAnimationControls } from './Flights3DAnimationControls';
import { Flights3DTooltip } from './Flights3DTooltip';

const INITIAL_VIEW_STATE: GlobeViewState = {
  longitude: 133,
  latitude: -25,
  zoom: 1.5
};

function NoSessionMessage() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
      <div className="bg-card border border-border text-card-foreground px-6 py-4 shadow-lg max-w-sm text-center pointer-events-auto">
        <p className="text-sm font-medium">No session selected</p>
        <p className="text-xs text-muted-foreground mt-1">
          Go to{' '}
          <a href="/flights" className="underline text-primary">
            /flights
          </a>{' '}
          and select a session to view its 3D globe trajectory.
        </p>
      </div>
    </div>
  );
}

/** Shared hook for globe view + basemap tile layer. */
function useGlobeBase() {
  const globeView = useMemo(() => new _GlobeView({ id: 'globe', repeat: true }), []);
  const basemapLayer = useMemo(
    () =>
      new TileLayer({
        id: 'carto-voyager-basemap',
        data: 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        minZoom: 0,
        maxZoom: 19,
        tileSize: 256,
        renderSubLayers: (props) => {
          const { west, south, east, north } = props.tile.bbox as GeoBoundingBox;
          return new BitmapLayer(props, {
            data: null,
            image: props.data,
            bounds: [west, south, east, north]
          });
        }
      }),
    []
  );
  return { globeView, basemapLayer };
}

function GlobeWithFlights({ requestId }: { requestId: string }) {
  const { globeView, basemapLayer } = useGlobeBase();
  const flightsLayers = useFlightsGlobeLayers(requestId);

  return (
    <DeckGL
      views={globeView}
      initialViewState={INITIAL_VIEW_STATE}
      controller={true}
      layers={[basemapLayer, ...flightsLayers]}
      style={{ width: '100%', height: '100%' }}
    />
  );
}

function GlobeEmpty() {
  const { globeView, basemapLayer } = useGlobeBase();

  return (
    <>
      <DeckGL
        views={globeView}
        initialViewState={INITIAL_VIEW_STATE}
        controller={true}
        layers={[basemapLayer]}
        style={{ width: '100%', height: '100%' }}
      />
      <NoSessionMessage />
    </>
  );
}

/**
 * FlightsGlobeMap
 *
 * Full-screen DeckGL globe for /flights/3dmap.
 * Shows flight trip trajectories with raw altitude (metres) as Z coordinate,
 * vertical drop lines, and vertical-rate colour encoding.
 *
 * Splits into outer (hydration gate) and inner (DeckGL) components so that
 * DeckGL constructors never run before the browser WebGL context is available.
 */
export function FlightsGlobeMap() {
  const searchParams = useSearchParams();
  const requestId = searchParams.get('requestId');
  const mounted = useHydrationAware();

  if (!mounted) return null;

  return (
    <main className="relative flex-1 min-h-0 overflow-hidden w-full">
      {requestId ? <GlobeWithFlights requestId={requestId} /> : <GlobeEmpty />}

      <Flights3DTooltip />

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
        <Flights3DAnimationControls />
      </div>
    </main>
  );
}
