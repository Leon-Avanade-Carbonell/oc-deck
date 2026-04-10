'use client';

import { useMemo, useEffect, useCallback, useRef } from 'react';
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
 * Population 0 → Light gray (#e0e0e0, 70% opacity)
 * Population 100k → Green (#22c55e, 70% opacity)
 */
function getColorAndOpacity(population: number): [number, number, number, number] {
  const maxPopulation = 1000;
  const normalizedPop = Math.min(population / maxPopulation, 1);

  // Linear interpolation from light gray to green
  const r = Math.round(224 + (34 - 224) * normalizedPop); // 224 → 34
  const g = Math.round(224 + (197 - 224) * normalizedPop); // 224 → 197
  const b = Math.round(224 + (94 - 224) * normalizedPop); // 224 → 94

  // Opacity: constant 70%
  const opacity = 178; // 70% of 255

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

  // Debounce timeout ref to prevent excessive hex regeneration during zoom/pan
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Regenerate hex cells when zoom or pan changes (with debounce)
  useEffect(() => {
    if (!mapInstance) return;

    const handleMapChange = () => {
      // Clear any pending update
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      // Debounce: only update after 150ms of inactivity
      debounceTimeoutRef.current = setTimeout(() => {
        const zoom = mapInstance.getZoom();
        const bounds = getMapBounds();
        const newHexCells = generateHexCells(zoom, bounds);
        setHexData(newHexCells);
      }, 150);
    };

    // Listen to both zoom and move (pan) events
    mapInstance.on('zoom', handleMapChange);
    mapInstance.on('move', handleMapChange);

    // Generate initial hex data
    handleMapChange();

    return () => {
      mapInstance.off('zoom', handleMapChange);
      mapInstance.off('move', handleMapChange);
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
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

  // Create the PolygonLayer with stable configuration
  // Keep the same layer instance across renders by only updating via updateTriggers
  // This prevents WebGL state corruption when visibility toggles
  const layer = useMemo(() => {
    const newLayer = new PolygonLayer({
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
        getFillColor: hexData,
        getPolygon: hexData
      }
    });
    return newLayer;
  }, [hexData]);

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
