'use client';

import { useAtom, useSetAtom } from 'jotai';
import { useEffect, useMemo, useState } from 'react';
import { BitmapLayer } from '@deck.gl/layers';
import { useSmartLayer } from '@/lib/hooks/useSmartLayer';
import { useHydrationAware } from '@/lib/hooks/useHydrationAware';
import { useGeoTIFFWorker } from '@/lib/hooks/useGeoTIFFWorker';
import { mapZoomLockedAtom } from '@/lib/atoms/map';

import {
  sampleClimateMvtImageUrlAtom,
  sampleClimateMvtHoveredValueAtom,
  sampleClimateMvtVisibleAtom,
  sampleClimateMvtIsDecodingAtom
} from '@/lib/atoms/sample-climate-mvt';

/**
 * SampleClimateMvtLayer
 *
 * Renders Cloud-Optimized GeoTIFF (COG) climate data from the climate-mvt API.
 *
 * Process:
 * 1. Fetch GeoTIFF from backend (WGS84, EPSG:4326)
 * 2. Send to Web Worker for decoding (off main thread)
 * 3. Worker extracts ImageBitmap and WGS84 bounds via image.getBoundingBox()
 * 4. Pass ImageBitmap + WGS84 bounds directly to BitmapLayer
 *    (BitmapLayer accepts ImageBitmap natively — no canvas PNG encode needed)
 *
 * Backend provides:
 * - GeoTIFFs reprojected to WGS84 (EPSG:4326)
 * - Embedded georeferencing (ModelPixelScale + ModelTiepoint)
 * - Alpha channel for NaN transparency support
 *
 * Data source: `/api/climate-mvt/{variable}/{time}/z{zoom}.tif`
 * Progressive zoom levels: z0 (256px) to z5 (8192px)
 *
 * Play coordination:
 * - sampleClimateMvtIsDecodingAtom is written here and read by the time picker
 * - The time picker advances to the next step only after this atom becomes false,
 *   ensuring every frame is actually rendered before moving on.
 */
export function SampleClimateMvtLayer() {
  const isHydrated = useHydrationAware();
  const [imageUrl] = useAtom(sampleClimateMvtImageUrlAtom);
  const [, setHoveredValue] = useAtom(sampleClimateMvtHoveredValueAtom);
  const [visible] = useAtom(sampleClimateMvtVisibleAtom);
  const [isDecoding, setIsDecoding] = useAtom(sampleClimateMvtIsDecodingAtom);
  const setMapZoomLocked = useSetAtom(mapZoomLockedAtom);
  const { decode: decodeGeoTIFF, cancelAll: cancelWorkerRequests } = useGeoTIFFWorker();

  // Lock map zoom while decoding — prevents zoom changes from triggering
  // additional fetches while a decode is already in flight.
  useEffect(() => {
    setMapZoomLocked(isDecoding);
  }, [isDecoding, setMapZoomLocked]);

  // State for decoded image and bounds
  const [decodedBitmap, setDecodedBitmap] = useState<ImageBitmap | null>(null);
  const [boundsFromGeoTIFF, setBoundsFromGeoTIFF] = useState<[number, number, number, number] | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);

  // Decode GeoTIFF when URL changes
  useEffect(() => {
    if (!isHydrated || !imageUrl) {
      setDecodedBitmap(null);
      setBoundsFromGeoTIFF(null);
      setIsDecoding(false);
      return;
    }

    let isMounted = true;
    const abortController = new AbortController();

    const decodeImage = async () => {
      try {
        setDecodeError(null);
        setIsDecoding(true);

        // Fetch the GeoTIFF file (abort signal allows cancellation when URL changes)
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
    };

    decodeImage();

    return () => {
      isMounted = false;
      abortController.abort(); // cancel in-flight fetch
      cancelWorkerRequests(); // reject any pending worker promises
    };
  }, [imageUrl, isHydrated, decodeGeoTIFF, cancelWorkerRequests, setIsDecoding]);

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
      opacity: 1.0,
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
