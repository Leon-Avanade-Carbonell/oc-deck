'use client';

import React from 'react';
import Map from 'react-map-gl/maplibre';
import { useAtomValue } from 'jotai';
import { basemapAtom, layersAtom } from '@/lib/atoms/map';
import { BASETILES } from '@/lib/map/basetiles';
import { DEFAULT_CONTROLS, DEFAULT_VIEWPORT } from '@/lib/map/config';
import { DeckGLOverlay } from './DeckGLOverlay';
import { useMapInitialization } from '@/lib/hooks/useMapInitialization';
import type { MapControls, MapViewport } from '@/lib/map/types';

import 'maplibre-gl/dist/maplibre-gl.css';

export interface BaseMapProps {
  /**
   * Smart layer components to render inside the map.
   * Each child should call `useSmartLayer` to register itself with DeckGL.
   * Children render `null` to the DOM — their visual output is via DeckGL canvas.
   */
  children?: React.ReactNode;
  /**
   * Initial viewport state. Defaults to Adelaide CBD at zoom 12.
   * Partial overrides are merged with DEFAULT_VIEWPORT.
   */
  initialViewport?: Partial<MapViewport>;
  /**
   * Map interaction controls. Defaults to pan + zoom only.
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
 * BaseMap is the root map component. It renders a MapLibre GL map with a DeckGL
 * overlay, and accepts smart layer components as children.
 *
 * ## Sizing
 * BaseMap fills its parent container (`width: 100%`, `height: 100%`).
 * Wrap it in a sized container to control dimensions:
 *
 * ```tsx
 * <div style={{ width: '100vw', height: '100vh' }}>
 *   <BaseMap>
 *     <CurrentLocationLayer />
 *   </BaseMap>
 * </div>
 * ```
 *
 * ## Adding Layers
 * Pass smart layer components as children. Each layer registers itself
 * via `useSmartLayer` and returns `null` from render:
 *
 * ```tsx
 * <BaseMap>
 *   <CurrentLocationLayer />
 *   <MyCustomLayer />
 * </BaseMap>
 * ```
 *
 * ## Basemap
 * The active basemap is controlled by `basemapAtom`. Use `BasemapSelector`
 * or write to the atom directly to switch basemaps.
 *
 * ## Controls
 * ```tsx
 * <BaseMap controls={{ pan: true, zoom: true, rotate: true, pitch: true }}>
 *   ...
 * </BaseMap>
 * ```
 */
export function BaseMap({ children, initialViewport, controls = DEFAULT_CONTROLS }: BaseMapProps) {
  const basemapId = useAtomValue(basemapAtom);
  const layers = useAtomValue(layersAtom);
  const mapStyle = BASETILES[basemapId].url;
  const viewport = { ...DEFAULT_VIEWPORT, ...initialViewport };

  // Pass all layers to DeckGL, with visible property set appropriately
  // This avoids layer recreation/destruction which can corrupt WebGL state
  const deckLayers = layers.map((l) => {
    // Set the visible property on the layer object
    (l.layer as any).visible = l.visible;
    return l.layer;
  });

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Map
        initialViewState={{
          longitude: viewport.center[0],
          latitude: viewport.center[1],
          zoom: viewport.zoom,
          pitch: viewport.pitch ?? 0,
          bearing: viewport.bearing ?? 0
        }}
        mapStyle={mapStyle}
        style={{ width: '100%', height: '100%' }}
        dragPan={controls?.pan ?? true}
        scrollZoom={controls?.zoom ?? true}
        dragRotate={controls?.rotate ?? false}
        pitchWithRotate={controls?.pitch ?? false}
        touchZoomRotate={controls?.zoom ?? true}
      >
        <DeckGLOverlay layers={deckLayers} />
        <MapContent>{children}</MapContent>
      </Map>
    </div>
  );
}
