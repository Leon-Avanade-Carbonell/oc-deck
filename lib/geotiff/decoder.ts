'use client';

import { fromArrayBuffer } from 'geotiff';

export type BandMode = 'rgb' | 'raw';

/**
 * Decodes a GeoTIFF file and returns an ImageBitmap
 * 
 * Supports two display modes:
 * - 'rgb': Displays bands 0-2 (red, green, blue) as a visual colormap
 * - 'raw': Displays band 3 (grayscale raw data) as normalized 0-255
 * 
 * @param arrayBuffer - The binary GeoTIFF file data
 * @param bandMode - Which bands to display ('rgb' or 'raw')
 * @returns Promise<ImageBitmap> - Ready to use with DeckGL BitmapLayer
 */
export async function decodeGeoTIFF(arrayBuffer: ArrayBuffer, bandMode: BandMode = 'rgb'): Promise<ImageBitmap> {
  try {
    // Parse the GeoTIFF file
    const tiff = await fromArrayBuffer(arrayBuffer);
    const image = await tiff.getImage();

    // Get image dimensions
    const width = image.getWidth();
    const height = image.getHeight();

    // Create ImageData for the canvas
    const imageData = new ImageData(width, height);
    const data = imageData.data; // Uint8ClampedArray [R, G, B, A, R, G, B, A, ...]

    if (bandMode === 'rgb') {
      // Extract RGB bands (0, 1, 2)
      const redBand = await image.readRasters({ samples: [0] });
      const greenBand = await image.readRasters({ samples: [1] });
      const blueBand = await image.readRasters({ samples: [2] });

      const red = redBand[0] as Uint8Array | Uint16Array;
      const green = greenBand[0] as Uint8Array | Uint16Array;
      const blue = blueBand[0] as Uint8Array | Uint16Array;

      // Determine if data is 8-bit or 16-bit
      const isUint16 = red instanceof Uint16Array;
      const maxValue = isUint16 ? 65535 : 255;

      // Fill ImageData with RGB values
      for (let i = 0; i < width * height; i++) {
        const r = isUint16 ? Math.round((red[i] / maxValue) * 255) : red[i];
        const g = isUint16 ? Math.round((green[i] / maxValue) * 255) : green[i];
        const b = isUint16 ? Math.round((blue[i] / maxValue) * 255) : blue[i];

        data[i * 4] = r; // R
        data[i * 4 + 1] = g; // G
        data[i * 4 + 2] = b; // B
        data[i * 4 + 3] = 255; // A (fully opaque)
      }
    } else {
      // Extract raw data band (typically band 3 for grayscale)
      const rawBand = await image.readRasters({ samples: [3] });
      const raw = rawBand[0] as Uint8Array | Uint16Array;

      // Determine if data is 8-bit or 16-bit
      const isUint16 = raw instanceof Uint16Array;
      const maxValue = isUint16 ? 65535 : 255;

      // Fill ImageData with grayscale values
      for (let i = 0; i < width * height; i++) {
        const normalized = isUint16 ? Math.round((raw[i] / maxValue) * 255) : raw[i];

        data[i * 4] = normalized; // R
        data[i * 4 + 1] = normalized; // G
        data[i * 4 + 2] = normalized; // B
        data[i * 4 + 3] = 255; // A (fully opaque)
      }
    }

    // Convert ImageData to ImageBitmap for efficient rendering
    const bitmap = await createImageBitmap(imageData);
    return bitmap;
  } catch (error) {
    console.error('[decodeGeoTIFF] Error decoding GeoTIFF:', error);
    throw error;
  }
}

/**
 * Generates a data URL from an ImageBitmap for use with BitmapLayer
 * Note: This is a workaround since BitmapLayer can accept data URLs
 */
export async function imageBitmapToDataUrl(bitmap: ImageBitmap): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  ctx.drawImage(bitmap, 0, 0);
  return canvas.toDataURL('image/png');
}
