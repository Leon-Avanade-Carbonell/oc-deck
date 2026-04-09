'use client';

import { useMemo, useEffect, useCallback } from 'react';
import { PolygonLayer } from '@deck.gl/layers';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { mapInstanceAtom } from '@/lib/atoms/map';
import { sampleHexDataAtom, sampleSelectedHexAtom, sampleHexLayerVisibleAtom } from '@/lib/atoms/sample-hex';
import { useSmartLayer } from '@/lib/hooks/useSmartLayer';
import { useDeckGLOverlay } from '@/lib/hooks/useDeckGLOverlay';
import { generateHexCells } from '@/lib/h3/sample-hexDataGenerator';

const LAYER_ID = 'hex-sample';

/**
 * Map population value to color and opacity
 * Population 0 → Light gray (#e0e0e0, 30% opacity)
 * Population 100k → Dark red (#d62728, 100% opacity)
 */
function getColorAndOpacity(population: number): [number, number, number, number] {
  const maxPopulation = 1000;
  const normalizedPop = Math.min(population / maxPopulation, 1);

  // Linear interpolation from gray to red
  const r = Math.round(224 + (214 - 224) * normalizedPop); // 224 → 214
  const g = Math.round(224 + (39 - 224) * normalizedPop); // 224 → 39
  const b = Math.round(224 + (40 - 224) * normalizedPop); // 224 → 40

  // Opacity: 30% → 100%
  const opacity = Math.round(76 + (255 - 76) * normalizedPop);

  return [r, g, b, opacity];
}

/**
 * SampleHexLayer renders H3 hexagons with random population data across Australia.
 *
 * - Zoom-aware: Changes H3 resolution based on zoom level (res 4, 7, or 10)
 * - Click to see hex data in a tooltip
 * - Filters to Australia bounds automatically
 *
 * Uses PolygonLayer with manual H3 boundary rendering.
 */
export function SampleHexLayer() {
  const mapInstance = useAtomValue(mapInstanceAtom);
  const [hexData, setHexData] = useAtom(sampleHexDataAtom);
  const setSelectedHex = useSetAtom(sampleSelectedHexAtom);
  const layerVisible = useAtomValue(sampleHexLayerVisibleAtom);
  const overlay = useDeckGLOverlay();

  // Function to get current map bounds
  const getMapBounds = useCallback((): [number, number, number, number] | null => {
    if (!mapInstance) return null;

    try {
      const bounds = mapInstance.getBounds();
      return [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
    } catch {
      return null;
    }
  }, [mapInstance]);

  // Regenerate hex cells when zoom or pan changes
  useEffect(() => {
    if (!mapInstance) return;

    const handleMapChange = () => {
      const zoom = mapInstance.getZoom();
      const bounds = getMapBounds();
      const newHexCells = generateHexCells(zoom, bounds);
      setHexData(newHexCells);
    };

    // Listen to both zoom and move (pan) events
    mapInstance.on('zoom', handleMapChange);
    mapInstance.on('move', handleMapChange);

    // Generate initial hex data
    handleMapChange();

    return () => {
      mapInstance.off('zoom', handleMapChange);
      mapInstance.off('move', handleMapChange);
    };
  }, [mapInstance, setHexData, getMapBounds]);

  // Handle click events on the layer
  const handleLayerClick = useCallback(
    (event: { x: number; y: number }) => {
      if (!overlay) return;

      // Use DeckGL's pick to find which hex was clicked
      const picked = overlay.pickObject({
        x: event.x,
        y: event.y,
        layerIds: [LAYER_ID]
      });

      if (picked?.object) {
        const hexCell = picked.object;
        setSelectedHex({
          hexId: hexCell.id,
          population: hexCell.population,
          x: event.x,
          y: event.y
        });
      }
    },
    [overlay, setSelectedHex]
  );

  // Create the PolygonLayer
  const layer = useMemo(
    () =>
      new PolygonLayer({
        id: LAYER_ID,
        data: hexData,
        getPolygon: (d) => d.geometry,
        getFillColor: (d) => getColorAndOpacity(d.population),
        getLineColor: [180, 180, 180, 200],
        lineWidthMinPixels: 1,
        pickable: true,
        autoHighlight: true,
        highlightColor: [255, 200, 0, 100],
        updateTriggers: {
          getFillColor: hexData
        }
      }),
    [hexData]
  );

  // Register layer with useSmartLayer
  const { setVisible } = useSmartLayer({
    id: LAYER_ID,
    layer,
    label: 'Hex Sample'
  });

  // Wire up visibility atom to layer visibility
  useEffect(() => {
    setVisible(layerVisible);
  }, [layerVisible, setVisible]);

  // Set up click handler on the overlay when it's ready
  useEffect(() => {
    if (!overlay) return;

    const canvas = overlay.getCanvas();
    if (!canvas) return;

    const handleCanvasClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      handleLayerClick({ x, y });
    };

    canvas.addEventListener('click', handleCanvasClick);

    return () => {
      canvas.removeEventListener('click', handleCanvasClick);
    };
  }, [overlay, handleLayerClick]);

  return null;
}
