'use client';

import { useAtom, useSetAtom } from 'jotai';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BitmapLayer } from '@deck.gl/layers';
import { useSmartLayer } from '@/lib/hooks/useSmartLayer';
import { useHydrationAware } from '@/lib/hooks/useHydrationAware';
import { useGeoTIFFWorker } from '@/lib/hooks/useGeoTIFFWorker';
import { mapZoomLockedAtom } from '@/lib/atoms/map';

import {
  buildClimateMvtUrl,
  sampleClimateMvtImageUrlAtom,
  sampleClimateMvtHoveredValueAtom,
  sampleClimateMvtVisibleAtom,
  sampleClimateMvtIsDecodingAtom,
  sampleClimateMvtZoomAtom,
  sampleClimateMvtAvailableTimesAtom,
  sampleClimateMvtTimeAtom,
  sampleClimateMvtVariableAtom,
  sampleClimateMvtColormapAtom,
  sampleClimateMvtStretchAtom
} from '@/lib/atoms/sample-climate-mvt';

/** Decoded GeoTIFF entry stored in the bitmap cache. */
interface BitmapCacheEntry {
  bitmap: ImageBitmap;
  bounds: [number, number, number, number];
}

/** Maximum number of decoded bitmaps held in memory across all time slices. */
const BITMAP_CACHE_MAX = 12;

/**
 * SampleClimateMvtLayer
 *
 * Renders Cloud-Optimized GeoTIFF (COG) climate data from the climate-mvt API.
 *
 * Process:
 * 1. Fetch GeoTIFF from backend (EPSG:3857, Web Mercator)
 * 2. Send to Web Worker for decoding (off main thread)
 * 3. Worker parses GeoTIFF with geotiff.js, extracts:
 *    - RGBA image from bands 1,2,3 (RGB) + band 5 (Alpha)
 *    - Bounding box derived from the GeoTIFF's affine transform
 *    - Converts EPSG:3857 meter bounds → WGS84 degrees
 * 4. Pass ImageBitmap + WGS84 bounds explicitly to BitmapLayer
 *    (BitmapLayer does NOT read GeoTIFF georeferencing natively)
 *
 * Backend provides:
 * - 5-band GeoTIFFs in EPSG:3857 (Web Mercator)
 *   Bands 1-3: RGB (pre-colormapped, uint8)
 *   Band 4: Grayscale (normalized raw data, uint8, 0-255)
 *   Band 5: Alpha (255 = valid, 0 = transparent/nodata)
 * - Embedded affine transform for georeferencing (authoritative bounds source)
 *
 * Data source: `/api/climate-mvt/{variable}/{time}/z{zoom}.tif`
 * Progressive zoom levels: z0 (256px) to z5 (8192px)
 *
 * Play coordination:
 * - sampleClimateMvtIsDecodingAtom is written here and read by the time picker
 * - The time picker advances to the next step only after this atom becomes false,
 *   ensuring every frame is actually rendered before moving on.
 *
 * Bitmap cache:
 * - Decoded bitmaps are kept in a useRef Map (bitmapCacheRef) keyed by URL.
 * - Cache-first lookup: if a URL is already decoded, render is instant.
 * - After each foreground decode, ±2 neighbor time slices are pre-fetched
 *   sequentially in the background so the next step is already in cache.
 * - Cache is cleared (and GPU memory freed via ImageBitmap.close()) whenever
 *   the COG zoom level changes, since all cached entries are zoom-specific.
 * - LRU eviction (oldest-first) caps the cache at BITMAP_CACHE_MAX entries.
 */
export function SampleClimateMvtLayer() {
  const isHydrated = useHydrationAware();
  const [imageUrl] = useAtom(sampleClimateMvtImageUrlAtom);
  const [, setHoveredValue] = useAtom(sampleClimateMvtHoveredValueAtom);
  const [visible] = useAtom(sampleClimateMvtVisibleAtom);
  const [isDecoding, setIsDecoding] = useAtom(sampleClimateMvtIsDecodingAtom);
  const setMapZoomLocked = useSetAtom(mapZoomLockedAtom);
  const { decode: decodeGeoTIFF, cancelAll: cancelWorkerRequests } = useGeoTIFFWorker();

  // Params needed to build neighbor URLs for background pre-fetch
  const [zoom] = useAtom(sampleClimateMvtZoomAtom);
  const [availableTimes] = useAtom(sampleClimateMvtAvailableTimesAtom);
  const [currentTime] = useAtom(sampleClimateMvtTimeAtom);
  const [variable] = useAtom(sampleClimateMvtVariableAtom);
  const [colormap] = useAtom(sampleClimateMvtColormapAtom);
  const [stretch] = useAtom(sampleClimateMvtStretchAtom);

  /**
   * In-memory bitmap cache: URL → decoded entry.
   * Stored in a ref (not atom) so Effect A (zoom-clear) and Effect B (decode)
   * both see the same synchronously-updated Map within the same render cycle,
   * avoiding stale-closure issues that would arise with Jotai state.
   */
  const bitmapCacheRef = useRef<Map<string, BitmapCacheEntry>>(new Map());

  // Lock map zoom while decoding — prevents zoom changes from triggering
  // additional fetches while a decode is already in flight.
  useEffect(() => {
    setMapZoomLocked(isDecoding);
  }, [isDecoding, setMapZoomLocked]);

  /**
   * Effect A — clear bitmap cache on COG zoom level change.
   *
   * All cached entries are zoom-specific (zoom is part of the URL key).
   * When the COG zoom changes, every cached bitmap is stale → close all to
   * free GPU/CPU memory and reset to an empty Map.
   *
   * The currently displayed bitmap is NOT cleared — it stays visible as a
   * placeholder until the new zoom-level data arrives. Nulling the bitmap
   * would cause a deck.gl crash (BitmapLayer accesses image.constructor
   * during prop diffing, which throws on null).
   *
   * IMPORTANT: declared before the decode effect so it runs first when both
   * zoom and imageUrl change together (which always happens on zoom change).
   * This guarantees the cache is empty before the decode effect's cache-first
   * lookup fires, ensuring a fresh fetch at the new zoom level.
   */
  useEffect(() => {
    const cache = bitmapCacheRef.current;
    if (cache.size === 0) return;
    console.log(`[SampleClimateMvtLayer] COG zoom changed to z${zoom} — clearing ${cache.size} cached bitmap(s)`);
    cache.forEach((entry) => entry.bitmap.close());
    bitmapCacheRef.current = new Map();
  }, [zoom]);

  // State for decoded image and bounds
  const [decodedBitmap, setDecodedBitmap] = useState<ImageBitmap | null>(null);
  const [boundsFromGeoTIFF, setBoundsFromGeoTIFF] = useState<[number, number, number, number] | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);

  /**
   * Inserts an entry into bitmapCacheRef with LRU eviction.
   * Map insertion order = LRU order; oldest key is first().
   */
  const addToCache = (url: string, entry: BitmapCacheEntry) => {
    const cache = bitmapCacheRef.current;
    if (cache.size >= BITMAP_CACHE_MAX) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey !== undefined) {
        cache.get(oldestKey)?.bitmap.close();
        cache.delete(oldestKey);
      }
    }
    cache.set(url, entry);
  };

  /**
   * Effect B — decode GeoTIFF when URL changes (cache-first).
   *
   * 1. Cache hit  → render instantly (zero fetch/decode latency).
   * 2. Cache miss → fetch + decode → store in cache → render.
   * 3. On success → sequentially pre-fetch ±2 neighbor time slices into cache
   *    so the next playback step is already decoded when the user arrives.
   *
   * The worker is single-flight: if the user advances time while a background
   * pre-fetch is running, the decode effect cleanup calls cancelWorkerRequests(),
   * which cancels the background decode and lets the foreground take priority.
   */
  useEffect(() => {
    if (!isHydrated || !imageUrl) {
      setDecodedBitmap(null);
      setBoundsFromGeoTIFF(null);
      setIsDecoding(false);
      return;
    }

    let isMounted = true;
    const abortController = new AbortController();
    let decodeSuccessful = false;

    const decodeImage = async () => {
      try {
        setDecodeError(null);

        // --- Cache-first lookup ---
        const cached = bitmapCacheRef.current.get(imageUrl);
        if (cached) {
          console.log('[SampleClimateMvtLayer] Cache hit for:', imageUrl);
          if (isMounted) {
            setDecodedBitmap(cached.bitmap);
            setBoundsFromGeoTIFF(cached.bounds);
          }
          decodeSuccessful = true;
          return;
        }

        // --- Cache miss: fetch + decode ---
        setIsDecoding(true);

        console.log('[SampleClimateMvtLayer] Fetching GeoTIFF from:', imageUrl);
        const response = await fetch(imageUrl, { signal: abortController.signal });
        if (!response.ok) {
          throw new Error(`Failed to fetch GeoTIFF: ${response.status} ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        console.log('[SampleClimateMvtLayer] ArrayBuffer created, size:', arrayBuffer.byteLength, 'bytes');

        // Verify we have a valid GeoTIFF (should start with TIFF header: "II*" or "MM*")
        const headerView = new Uint8Array(arrayBuffer, 0, 4);
        const header = String.fromCharCode(...headerView);
        const isValidTiff = header.startsWith('II*') || header.startsWith('MM*');

        if (!isValidTiff) {
          throw new Error(
            `Invalid GeoTIFF format. Header: ${Array.from(headerView)
              .map((b) => b.toString(16))
              .join(' ')}`
          );
        }

        // Decode GeoTIFF in Web Worker to avoid blocking main thread
        console.log('[SampleClimateMvtLayer] Sending to Web Worker for decoding...');
        const { bitmap, bounds } = await decodeGeoTIFF(arrayBuffer);
        console.log(
          '[SampleClimateMvtLayer] GeoTIFF decoded successfully, size:',
          bitmap.width,
          'x',
          bitmap.height,
          'bounds:',
          bounds
        );

        // BitmapLayer accepts ImageBitmap directly — no canvas PNG encoding needed.
        // deck.gl uploads the bitmap to GPU texture during its next render cycle.
        if (isMounted) {
          setDecodedBitmap(bitmap);
          setBoundsFromGeoTIFF(bounds);
          addToCache(imageUrl, { bitmap, bounds });
          decodeSuccessful = true;
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          // Fetch was aborted because URL changed — expected during playback, not an error
          return;
        }
        if (error instanceof Error && error.message === 'Decode cancelled') {
          // Worker request was cancelled by cancelAll() — expected during URL changes
          return;
        }
        if (error instanceof Error && error.message === 'Superseded by new decode request') {
          // Worker cancelled this request in favour of a newer foreground decode
          return;
        }

        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('[SampleClimateMvtLayer] Decode error:', errorMsg);

        if (isMounted) {
          setDecodeError(errorMsg);
        }
      } finally {
        if (isMounted) {
          setIsDecoding(false);
        }
      }

      // --- Background pre-fetch ±2 neighbor time slices ---
      // Only runs after a successful foreground decode; aborted if URL changes.
      // Uses the same single-flight worker: a new foreground decode call will
      // cancel any in-progress background decode automatically.
      if (!decodeSuccessful || !isMounted || abortController.signal.aborted) return;

      const currentIndex = availableTimes.indexOf(currentTime);
      const neighborOffsets = [-2, -1, 1, 2] as const;

      for (const offset of neighborOffsets) {
        if (!isMounted || abortController.signal.aborted) break;

        const neighborIndex = currentIndex + offset;
        if (neighborIndex < 0 || neighborIndex >= availableTimes.length) continue;

        const neighborTime = availableTimes[neighborIndex];
        const neighborUrl = buildClimateMvtUrl(variable, neighborTime, zoom, colormap, stretch);

        if (bitmapCacheRef.current.has(neighborUrl)) {
          console.log('[SampleClimateMvtLayer] Pre-fetch skip (cached):', neighborUrl);
          continue;
        }

        try {
          console.log('[SampleClimateMvtLayer] Pre-fetching neighbor:', neighborUrl);
          const res = await fetch(neighborUrl, { signal: abortController.signal });
          if (!res.ok) continue;

          const buf = await res.arrayBuffer();
          const result = await decodeGeoTIFF(buf);

          if (isMounted && !abortController.signal.aborted) {
            addToCache(neighborUrl, result);
            console.log('[SampleClimateMvtLayer] Pre-fetch cached:', neighborUrl);
          }
        } catch {
          // Background pre-fetch failures are silently ignored — they are an
          // optimistic optimization; the foreground decode will handle the miss.
        }
      }
    };

    decodeImage();

    return () => {
      isMounted = false;
      abortController.abort(); // cancel in-flight fetch (foreground or background)
      cancelWorkerRequests(); // reject any pending worker promises
    };
  }, [
    imageUrl,
    isHydrated,
    decodeGeoTIFF,
    cancelWorkerRequests,
    setIsDecoding,
    availableTimes,
    currentTime,
    variable,
    zoom,
    colormap,
    stretch
  ]);

  // Create BitmapLayer with decoded image and extracted bounds.
  // `visible` is included in the layer props — DeckGL keeps the layer alive but
  // skips rendering when false. This prevents the instance from being finalized
  // and avoids "deck.gl: assertion failed" on toggle off → on.
  // Fallback bounds [0,0,1,1] is a valid degenerate box (used only when image is null).
  const layer = useMemo(() => {
    return new BitmapLayer({
      id: 'sample-climate-mvt',
      visible,
      image: decodedBitmap,
      bounds: boundsFromGeoTIFF ?? ([0, 0, 1, 1] as [number, number, number, number]),
      pickable: true,
      opacity: 0.4,
      tintColor: [255, 255, 255],
      desaturate: 0,
      onClick: (info) => {
        if (info.color) {
          const pixelValue = info.color[0];
          setHoveredValue(pixelValue);
          console.log('[SampleClimateMvtLayer] Clicked pixel value:', pixelValue);
        }
      },
      onHover: (info) => {
        if (info.color) {
          const pixelValue = info.color[0];
          setHoveredValue(pixelValue);
        }
      },
      updateTriggers: {
        image: [decodedBitmap],
        bounds: [boundsFromGeoTIFF]
      }
    });
  }, [visible, decodedBitmap, boundsFromGeoTIFF, setHoveredValue]);

  // Register layer with smart layer system
  const { setVisible: setLayerVisible } = useSmartLayer({
    id: 'sample-climate-mvt',
    layer,
    label: 'Climate MVT Data'
  });

  // Sync visibility atom to layer visibility
  useEffect(() => {
    setLayerVisible(visible);
  }, [visible, setLayerVisible]);

  // Don't render layer until after hydration
  if (!isHydrated) {
    return null;
  }

  if (decodeError) {
    console.error('[SampleClimateMvtLayer] Decode error:', decodeError);
  }

  // Layer component (renders via DeckGL, not DOM)
  return null;
}
