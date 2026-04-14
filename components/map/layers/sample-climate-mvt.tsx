'use client';

import { useAtom } from 'jotai';
import { useEffect, useMemo, useState } from 'react';
import { BitmapLayer } from '@deck.gl/layers';
import { useSmartLayer } from '@/lib/hooks/useSmartLayer';
import { useHydrationAware } from '@/lib/hooks/useHydrationAware';
import { imageBitmapToDataUrl } from '@/lib/geotiff/decoder';
import { useGeoTIFFWorker } from '@/lib/hooks/useGeoTIFFWorker';

import {
  sampleClimateMvtImageUrlAtom,
  sampleClimateMvtHoveredValueAtom,
  sampleClimateMvtVisibleAtom
} from '@/lib/atoms/sample-climate-mvt';

/**
 * SampleClimateMvtLayer
 *
 * Renders Cloud-Optimized GeoTIFF (COG) climate data from the climate-mvt API.
 *
 * Process:
 * 1. Fetch GeoTIFF from backend (Web Mercator, EPSG:3857)
 * 2. Send to Web Worker for decoding (off main thread)
 * 3. Worker extracts ImageBitmap and bounds metadata
 * 4. Convert ImageBitmap to PNG data URL (format BitmapLayer supports)
 * 5. Pass image URL + bounds to BitmapLayer
 *
 * Backend provides:
 * - GeoTIFFs in Web Mercator projection (EPSG:3857)
 * - Embedded georeferencing (ModelPixelScale + ModelTiepoint)
 * - Metadata tags (CRS, BOUNDS_WGS84)
 * - Alpha channel for NaN transparency support
 *
 * Data source: `/api/climate-mvt/{variable}/{time}/z{zoom}.tif`
 * Progressive zoom levels: z0 (256px) to z5 (8192px)
 */
export function SampleClimateMvtLayer() {
  const isHydrated = useHydrationAware();
  const [imageUrl] = useAtom(sampleClimateMvtImageUrlAtom);
  const [, setHoveredValue] = useAtom(sampleClimateMvtHoveredValueAtom);
  const [visible] = useAtom(sampleClimateMvtVisibleAtom);
  const { decode: decodeGeoTIFF } = useGeoTIFFWorker();

  // State for decoded image and bounds
  const [decodedImageUrl, setDecodedImageUrl] = useState<string | null>(null);
  const [boundsFromGeoTIFF, setBoundsFromGeoTIFF] = useState<[number, number, number, number] | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [isDecoding, setIsDecoding] = useState(false);

  // Decode GeoTIFF when URL changes
  useEffect(() => {
    if (!isHydrated || !imageUrl) {
      setDecodedImageUrl(null);
      setBoundsFromGeoTIFF(null);
      return;
    }

    let isMounted = true;

    const decodeImage = async () => {
      try {
        setDecodeError(null);
        setIsDecoding(true);

        // Fetch the GeoTIFF file
        console.log('[SampleClimateMvtLayer] Fetching GeoTIFF from:', imageUrl);
        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch GeoTIFF: ${response.status} ${response.statusText}`);
        }

        console.log(
          '[SampleClimateMvtLayer] Response received, Content-Type:',
          response.headers.get('content-type'),
          'Content-Length:',
          response.headers.get('content-length')
        );

        const arrayBuffer = await response.arrayBuffer();
        console.log('[SampleClimateMvtLayer] ArrayBuffer created, size:', arrayBuffer.byteLength, 'bytes');

        // Verify we have a valid GeoTIFF (should start with TIFF header: "II*" or "MM*")
        const headerView = new Uint8Array(arrayBuffer, 0, 4);
        const header = String.fromCharCode(...headerView);
        console.log(
          '[SampleClimateMvtLayer] TIFF header bytes:',
          header.charCodeAt(0),
          header.charCodeAt(1),
          header.charCodeAt(2),
          header.charCodeAt(3)
        );
        const isValidTiff = header.startsWith('II*') || header.startsWith('MM*');
        console.log('[SampleClimateMvtLayer] Is valid TIFF header:', isValidTiff);

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

        // Convert ImageBitmap to PNG data URL (format BitmapLayer supports)
        const dataUrl = await imageBitmapToDataUrl(bitmap);

        if (isMounted) {
          setDecodedImageUrl(dataUrl);
          setBoundsFromGeoTIFF(bounds);
        }

        bitmap.close(); // Free memory
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('[SampleClimateMvtLayer] Decode error:', errorMsg);
        if (error instanceof Error) {
          console.error('[SampleClimateMvtLayer] Stack:', error.stack);
        }

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
    };
  }, [imageUrl, isHydrated, decodeGeoTIFF]);

  // Create BitmapLayer with decoded image and extracted bounds
  // When image is not ready yet, create a layer with default values that won't render
  const layer = useMemo(() => {
    return new BitmapLayer({
      id: 'sample-climate-mvt',
      image: decodedImageUrl || undefined,
      bounds: boundsFromGeoTIFF || undefined,
      pickable: true,
      opacity: 0.5,
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
        image: [decodedImageUrl],
        bounds: [boundsFromGeoTIFF]
      }
    });
  }, [decodedImageUrl, boundsFromGeoTIFF, setHoveredValue]);

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

  if (isDecoding) {
    console.log('[SampleClimateMvtLayer] Decoding in progress...');
  }

  // Layer component (renders via DeckGL, not DOM)
  return null;
}
