'use client';

import { useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { useHydrationAware } from '@/lib/hooks/useHydrationAware';
import { _GlobeView, type GlobeViewState } from '@deck.gl/core';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer } from '@deck.gl/layers';
import type { GeoBoundingBox } from '@deck.gl/geo-layers';

const INITIAL_VIEW_STATE: GlobeViewState = {
  longitude: 133,
  latitude: -25,
  zoom: 2
};

/**
 * Inner component that creates DeckGL views and layers.
 * Only mounted after hydration so WebGL context is guaranteed to exist.
 */
function GlobeContent() {
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

  return (
    <DeckGL
      views={globeView}
      initialViewState={INITIAL_VIEW_STATE}
      controller={true}
      layers={[basemapLayer]}
      style={{ width: '100%', height: '100%' }}
    />
  );
}

/**
 * Globe3DMap
 *
 * A full-screen DeckGL globe using CARTO Voyager raster tiles as the basemap.
 * Used by the /3dmap page.
 *
 * Splits into outer (hydration gate) and inner (DeckGL) components so that
 * DeckGL layer/view constructors never run before the browser WebGL context
 * is available. useMemo runs during the first render — before any early return
 * — so gating with a mounted check in the same component is insufficient.
 */
export function Globe3DMap() {
  const mounted = useHydrationAware();
  if (!mounted) return null;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <GlobeContent />
    </div>
  );
}
