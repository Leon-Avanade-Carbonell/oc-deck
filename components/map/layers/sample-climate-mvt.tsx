'use client';

import { useAtom } from 'jotai';
import { useEffect, useMemo, useState } from 'react';
import { BitmapLayer } from '@deck.gl/layers';
import { useSmartLayer } from '@/lib/hooks/useSmartLayer';
import { useHydrationAware } from '@/lib/hooks/useHydrationAware';
import { decodeGeoTIFF, imageBitmapToDataUrl } from '@/lib/geotiff/decoder';

import {
  sampleClimateMvtImageUrlAtom,
  sampleClimateMvtBoundsAtom,
  sampleClimateMvtHoveredValueAtom,
  sampleClimateMvtVisibleAtom,
  sampleClimateMvtBandModeAtom
} from '@/lib/atoms/sample-climate-mvt';

/**
 * SampleClimateMvtLayer
 *
 * Renders Cloud-Optimized GeoTIFF (COG) climate data from the climate-mvt API.
 * Decodes GeoTIFF files server-side and renders them via DeckGL's BitmapLayer.
 *
 * Data source: `/climate-mvt/{variable}/{time}/z{zoom}.tif`
 * Bounds: Australia extent (112.85°E, -43.65°S to 154.0°E, -10.0°S)
 *
 * GeoTIFF Structure:
 * - Bands 0-2: RGB visual (green colormap)
 * - Band 3: Grayscale raw data (normalized 0-255)
 * - Georeferencing: WGS84 (EPSG:4326)
 *
 * Display Modes:
 * - 'rgb': Render colored visual representation
 * - 'raw': Render grayscale raw measurement data
 */
export function SampleClimateMvtLayer() {
  const isHydrated = useHydrationAware();
  const [imageUrl] = useAtom(sampleClimateMvtImageUrlAtom);
  const [bounds] = useAtom(sampleClimateMvtBoundsAtom);
  const [, setHoveredValue] = useAtom(sampleClimateMvtHoveredValueAtom);
  const [visible] = useAtom(sampleClimateMvtVisibleAtom);
  const [bandMode] = useAtom(sampleClimateMvtBandModeAtom);

  // State for decoded image
  const [decodedImageUrl, setDecodedImageUrl] = useState<string | null>(null);
  const [isDecoding, setIsDecoding] = useState(false);
  const [decodeError, setDecodeError] = useState<string | null>(null);

  // Decode GeoTIFF when URL or band mode changes
  useEffect(() => {
    if (!isHydrated || !imageUrl) {
      setDecodedImageUrl(null);
      return;
    }

    let isMounted = true;

    const decodeImage = async () => {
      try {
        setIsDecoding(true);
        setDecodeError(null);

        // Fetch the GeoTIFF file
        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch GeoTIFF: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();

        // Decode GeoTIFF to ImageBitmap
        const bitmap = await decodeGeoTIFF(arrayBuffer, bandMode);
        console.log('[SampleClimateMvtLayer] GeoTIFF decoded successfully, size:', bitmap.width, 'x', bitmap.height);

        // Convert ImageBitmap to data URL for BitmapLayer
        const dataUrl = await imageBitmapToDataUrl(bitmap);
        console.log('[SampleClimateMvtLayer] Data URL created, length:', dataUrl.length);

        if (isMounted) {
          setDecodedImageUrl(dataUrl);
          setIsDecoding(false);
        }

        bitmap.close(); // Free memory
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('[SampleClimateMvtLayer] Decode error:', errorMsg);

        if (isMounted) {
          setDecodeError(errorMsg);
          setIsDecoding(false);
        }
      }
    };

    decodeImage();

    return () => {
      isMounted = false;
    };
  }, [imageUrl, bandMode, isHydrated]);

  // Create BitmapLayer with decoded image
  const layer = useMemo(
    () =>
      new BitmapLayer({
        id: 'sample-climate-mvt',
        image: decodedImageUrl, // Can be undefined, which BitmapLayer should handle gracefully
        bounds,
        pickable: true,
        opacity: 0.7,
        desaturate: 0,
        onClick: (info) => {
          // Extract pixel value from the decoded image
          if (info.color) {
            // For grayscale, R=G=B, so just use R channel
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
          bounds: [bounds]
        }
      }),
    [decodedImageUrl, bounds, setHoveredValue]
  );

  // Only register layer if we have a valid layer instance
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

  // Debug: Show decode status
  if (isDecoding) {
    console.log('[SampleClimateMvtLayer] Decoding GeoTIFF...', { imageUrl, bandMode });
  }

  if (decodeError) {
    console.error('[SampleClimateMvtLayer] Decode error:', decodeError);
  }

  // Layer component (renders via DeckGL, not DOM)
  return null;
}
