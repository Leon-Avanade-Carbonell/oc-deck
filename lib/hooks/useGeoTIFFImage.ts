'use client';

import { useEffect, useState } from 'react';
import { fromArrayBuffer } from 'geotiff';

/**
 * useGeoTIFFImage
 * Fetches and decodes a GeoTIFF image URL and converts it to a canvas
 * for use with DeckGL's BitmapLayer.
 *
 * @param imageUrl - The URL to the GeoTIFF file
 * @returns Object with { imageData, isLoading, error }
 */
export function useGeoTIFFImage(imageUrl: string) {
  const [imageData, setImageData] = useState<HTMLCanvasElement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadGeoTIFF = async () => {
      try {
        setIsLoading(true);
        setError(null);

        console.log(`[useGeoTIFFImage] Fetching: ${imageUrl}`);

        // Fetch the GeoTIFF file
        const response = await fetch(imageUrl, {
          cache: 'no-store' // Bypass caching to ensure fresh data
        });

        console.log(`[useGeoTIFFImage] Response status: ${response.status} ${response.statusText}`);
        console.log(`[useGeoTIFFImage] Content-Type: ${response.headers.get('content-type')}`);

        if (!response.ok) {
          const errorBody = await response.text();
          console.error(`[useGeoTIFFImage] Error response body:`, errorBody);
          throw new Error(`Failed to fetch GeoTIFF: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();

        // Parse the GeoTIFF
        const tiff = await fromArrayBuffer(arrayBuffer);
        const image = await tiff.getImage();

        // Get the raster data
        const data = await image.readRasters();
        const width = image.getWidth();
        const height = image.getHeight();

        // Create a canvas to render the image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Failed to get canvas context');
        }

        // Get pixel data (assuming RGB bands + alpha)
        // data is an object with arrays for each band: { 0: [...], 1: [...], 2: [...], 3: [...] }
        const imageDataObj = ctx.createImageData(width, height);
        const pixelData = imageDataObj.data;

        // Map the GeoTIFF bands to RGBA
        // For a 4-band GeoTIFF (RGB + grayscale)
        const band0 = data[0] || new Uint8Array(width * height);
        const band1 = data[1] || new Uint8Array(width * height);
        const band2 = data[2] || new Uint8Array(width * height);
        const band3 = data[3] || new Uint8Array(width * height).fill(255); // Alpha channel

        for (let i = 0; i < width * height; i++) {
          pixelData[i * 4 + 0] = band0[i]; // R
          pixelData[i * 4 + 1] = band1[i]; // G
          pixelData[i * 4 + 2] = band2[i]; // B
          pixelData[i * 4 + 3] = band3[i]; // A
        }

        ctx.putImageData(imageDataObj, 0, 0);

        if (isMounted) {
          setImageData(canvas);
          console.log(`[useGeoTIFFImage] Successfully decoded GeoTIFF: ${width}x${height}`);
        }
      } catch (err) {
        if (isMounted) {
          const error = err instanceof Error ? err : new Error(String(err));
          setError(error);
          console.error('[useGeoTIFFImage] Error loading GeoTIFF:', error);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadGeoTIFF();

    return () => {
      isMounted = false;
    };
  }, [imageUrl]);

  return { imageData, isLoading, error };
}
