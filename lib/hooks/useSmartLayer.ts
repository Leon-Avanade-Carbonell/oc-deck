'use client';

import { useCallback, useEffect } from 'react';
import { useSetAtom } from 'jotai';
import type { Layer } from '@deck.gl/core';
import { layersAtom } from '@/lib/atoms/map';

/**
 * Configuration passed to `useSmartLayer`.
 */
export interface SmartLayerConfig {
  /** Stable unique identifier for this layer. Must not change across renders. */
  id: string;
  /**
   * The DeckGL layer instance to render.
   * Memoize this with `useMemo` in the calling component so that the atom
   * only updates when the underlying data or props actually change.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  layer: Layer<any>;
  /** Human-readable label shown in layer control UIs. */
  label: string;
  /** Stacking order for this layer — higher values render on top. Defaults to 0. */
  order?: number;
}

/**
 * Return value from `useSmartLayer`.
 */
export interface SmartLayerHandle {
  /**
   * Programmatically toggle visibility for this layer.
   * Equivalent to setting `visible` on the layer's entry in `layersAtom`.
   */
  setVisible: (visible: boolean) => void;
}

/**
 * Hook template for creating smart DeckGL layers that integrate automatically
 * with the BaseMap system.
 *
 * Responsibilities handled by this hook:
 * - **Register**: Adds the layer to `layersAtom` on mount (visible by default)
 * - **Update**: Updates the layer instance in the atom when `config.layer` changes
 * - **Unregister**: Removes the layer from `layersAtom` on unmount
 *
 * ## Usage
 *
 * ```tsx
 * 'use client';
 *
 * import { useMemo } from 'react';
 * import { ScatterplotLayer } from '@deck.gl/layers';
 * import { useSmartLayer } from '@/lib/hooks/useSmartLayer';
 *
 * export function MyLayer() {
 *   const layer = useMemo(
 *     () =>
 *       new ScatterplotLayer({
 *         id: 'my-layer',
 *         data: [{ position: [138.6, -34.9] }],
 *         getPosition: (d) => d.position,
 *         getRadius: 100,
 *         getFillColor: [255, 0, 128],
 *       }),
 *     []
 *   );
 *
 *   useSmartLayer({ id: 'my-layer', layer, label: 'My Layer' });
 *
 *   return null; // layers render via DeckGL canvas, not the DOM
 * }
 * ```
 *
 * ## Visibility
 *
 * The returned `setVisible` function can toggle the layer without removing it:
 *
 * ```ts
 * const { setVisible } = useSmartLayer({ id, layer, label });
 * setVisible(false); // hides the layer (still registered in atom)
 * ```
 *
 * Alternatively, read/write `layersAtom` directly for bulk visibility changes.
 *
 * ## Updating layer data
 *
 * To update the layer when data changes, memoize the layer and include data
 * in the dependency array. Use DeckGL `updateTriggers` for efficient diffing:
 *
 * ```ts
 * const layer = useMemo(
 *   () =>
 *     new ScatterplotLayer({
 *       id: 'my-layer',
 *       data,
 *       getPosition: (d) => d.position,
 *       updateTriggers: { getPosition: data },
 *     }),
 *   [data]
 * );
 * ```
 */
export function useSmartLayer(config: SmartLayerConfig): SmartLayerHandle {
  const { id, layer, label, order = 0 } = config;
  const setLayers = useSetAtom(layersAtom);

  // Register layer on mount; unregister on unmount
  useEffect(() => {
    setLayers((prev) => [...prev.filter((l) => l.id !== id), { id, layer, visible: true, label, order }]);

    return () => {
      setLayers((prev) => prev.filter((l) => l.id !== id));
    };
    // Only re-register when id, label, or order changes (not on every layer update)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, label, order]);

  // Update the layer instance in the atom when it changes
  useEffect(() => {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, layer } : l)));
  }, [id, layer, setLayers]);

  const setVisible = useCallback(
    (visible: boolean) => {
      setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, visible } : l)));
    },
    [id, setLayers]
  );

  return { setVisible };
}
