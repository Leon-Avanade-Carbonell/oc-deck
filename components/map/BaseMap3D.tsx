'use client';

import React, { useCallback } from 'react';
import Map from 'react-map-gl/maplibre';
import { useAtomValue } from 'jotai';
import { layersAtom } from '@/lib/atoms/map';
import { BASETILES } from '@/lib/map/basetiles';
import { DeckGLOverlay } from './DeckGLOverlay';
import { useMapInitialization } from '@/lib/hooks/useMapInitialization';
import type { MapControls, MapViewport } from '@/lib/map/types';
import type { MapLibreEvent } from 'maplibre-gl';

import 'maplibre-gl/dist/maplibre-gl.css';

/** Default 3D viewport: Sydney CBD, pitched at 60° for strong depth effect. */
const DEFAULT_3D_VIEWPORT: MapViewport = {
  center: [151.2093, -33.8688],
  zoom: 15,
  pitch: 60,
  bearing: 0
};

/** 3D controls: pan + zoom + rotate + pitch all enabled. */
const DEFAULT_3D_CONTROLS: MapControls = {
  pan: true,
  zoom: true,
  rotate: true,
  pitch: true
};

export interface BaseMap3DProps {
  /**
   * Smart layer components to render inside the map.
   * Each child should call `useSmartLayer` to register itself with DeckGL.
   */
  children?: React.ReactNode;
  /**
   * Initial viewport state. Defaults to Sydney CBD at zoom 15, pitch 60°.
   * Partial overrides are merged with the 3D defaults.
   */
  initialViewport?: Partial<MapViewport>;
  /**
   * Map interaction controls. Defaults to pan + zoom + rotate + pitch all enabled.
   */
  controls?: MapControls;
}

/**
 * Internal component rendered inside `<Map>` to write the MapLibre instance
 * to `mapInstanceAtom` and render smart layer children.
 */
function MapContent({ children }: { children: React.ReactNode }) {
  useMapInitialization();
  return <>{children}</>;
}

/**
 * BaseMap3D is a 3D-focused map component. It renders a MapLibre GL map with:
 * - Voyager basemap (detailed street-level data, good contrast for 3D)
 * - 60° pitch for a strong depth perspective
 * - Rotate + pitch interactions enabled
 * - OSM building extrusion via MapLibre `fill-extrusion` layer
 * - A DeckGL overlay for any additional smart layers passed as children
 *
 * ## Sizing
 * Fills its parent container. Wrap in a sized container:
 * ```tsx
 * <div style={{ width: '100vw', height: '100vh' }}>
 *   <BaseMap3D />
 * </div>
 * ```
 */
export function BaseMap3D({ children, initialViewport, controls = DEFAULT_3D_CONTROLS }: BaseMap3DProps) {
  const layers = useAtomValue(layersAtom);
  const mapStyle = BASETILES['voyager'].url;
  const viewport = { ...DEFAULT_3D_VIEWPORT, ...initialViewport };

  const allLayers = layers.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((l) => l.layer);

  /**
   * Inject the OSM building fill-extrusion layer once the MapLibre style has loaded.
   * We use real OSM `height` values with a 10m fallback for buildings without height data.
   */
  const handleMapLoad = useCallback((event: MapLibreEvent) => {
    const map = event.target;

    // Guard: only add if not already present (handles style reloads)
    if (map.getLayer('3d-buildings')) return;

    // Find the first symbol layer in the style to insert buildings beneath labels
    const layers = map.getStyle().layers;
    let firstSymbolId: string | undefined;
    for (const layer of layers) {
      if (layer.type === 'symbol') {
        firstSymbolId = layer.id;
        break;
      }
    }

    map.addLayer(
      {
        id: '3d-buildings',
        source: 'carto',
        'source-layer': 'building',
        type: 'fill-extrusion',
        minzoom: 13,
        paint: {
          // Neutral gray base, slightly lighter roof for depth
          'fill-extrusion-color': '#aab7c4',
          // OpenMapTiles schema uses render_height/render_min_height (pre-processed from OSM)
          'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 10],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          // Fade buildings in as you zoom past 13
          'fill-extrusion-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 14, 0.85]
        }
      },
      // Insert below labels so text stays readable
      firstSymbolId
    );
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Map
        initialViewState={{
          longitude: viewport.center[0],
          latitude: viewport.center[1],
          zoom: viewport.zoom,
          pitch: viewport.pitch ?? 60,
          bearing: viewport.bearing ?? 0
        }}
        mapStyle={mapStyle}
        style={{ width: '100%', height: '100%' }}
        dragPan={controls?.pan ?? true}
        scrollZoom={controls?.zoom ?? true}
        dragRotate={controls?.rotate ?? true}
        pitchWithRotate={controls?.pitch ?? true}
        touchZoomRotate={controls?.zoom ?? true}
        onLoad={handleMapLoad}
      >
        <DeckGLOverlay layers={allLayers} pickingRadius={16} />
        <MapContent>{children}</MapContent>
      </Map>
    </div>
  );
}
