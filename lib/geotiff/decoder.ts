'use client';

import { fromArrayBuffer } from 'geotiff';

export type BandMode = 'rgb' | 'raw';

/**
 * Converts a single Web Mercator (EPSG:3857) point to WGS84 degrees.
 */
function webMercatorToWgs84(x: number, y: number): [number, number] {
  const earthRadius = 6378137;
  const lng = (x / earthRadius) * (180 / Math.PI);
  const lat = (Math.atan(Math.exp(y / earthRadius)) * 2 - Math.PI / 2) * (180 / Math.PI);
  return [lng, lat];
}

/**
 * Converts bounds from Web Mercator (EPSG:3857) to WGS84 degrees.
 * @param bounds [west, south, east, north] in meters
 * @returns [west, south, east, north] in degrees
 */
function convertBoundsWebMercatorToWgs84(bounds: [number, number, number, number]): [number, number, number, number] {
  const [west, south, east, north] = bounds;
  const [westLng] = webMercatorToWgs84(west, 0);
  const [, southLat] = webMercatorToWgs84(0, south);
  const [eastLng] = webMercatorToWgs84(east, 0);
  const [, northLat] = webMercatorToWgs84(0, north);
  return [westLng, southLat, eastLng, northLat];
}

export interface GeoTIFFDecodedResult {
  bitmap: ImageBitmap;
  bounds: [number, number, number, number]; // [west, south, east, north] in WGS84 degrees
}

/**
 * Decodes a GeoTIFF file and extracts bounds from metadata.
 *
 * Supports two display modes:
 * - 'rgb': Displays bands 0-2 (red, green, blue) as a visual colormap + band 4 (alpha) for transparency
 * - 'raw': Displays band 3 (grayscale raw data) as normalized 0-255 + band 4 (alpha) for transparency
 *
 * Backend band layout (1-indexed → 0-indexed):
 * - Bands 1-3 (samples 0-2): RGB (pre-colormapped, uint8)
 * - Band 4  (sample 3):      Grayscale (normalized raw data, uint8, 0-255)
 * - Band 5  (sample 4):      Alpha (255 = valid, 0 = transparent/nodata)
 *
 * Transparency Support:
 * - NaN values in the data are represented as alpha=0 (transparent pixels)
 * - Valid data values have alpha=255 (opaque)
 * - When rendered on DeckGL, transparent pixels show the map background instead of blocking it
 *
 * Extracts georeferencing bounds from the GeoTIFF's affine transform
 * (ModelTiepoint + ModelPixelScale or ModelTransformation) via image.getBoundingBox().
 * This is the authoritative source for positioning and accounts for the half-pixel
 * correction applied on the backend. Do NOT use the BOUNDS_WGS84 metadata tag.
 * For EPSG:3857 TIFs, bounds are converted from meters to WGS84 degrees.
 *
 * @param arrayBuffer - The binary GeoTIFF file data
 * @param bandMode - Which bands to display ('rgb' or 'raw')
 * @returns Promise<GeoTIFFDecodedResult> - ImageBitmap (with transparency) and WGS84 bounds for BitmapLayer
 */
export async function decodeGeoTIFF(
  arrayBuffer: ArrayBuffer,
  bandMode: BandMode = 'rgb'
): Promise<GeoTIFFDecodedResult> {
  try {
    console.log('[decodeGeoTIFF] Starting decode, arrayBuffer size:', arrayBuffer.byteLength);

    let tiff;
    try {
      tiff = await fromArrayBuffer(arrayBuffer);
      console.log('[decodeGeoTIFF] GeoTIFF parsed successfully');
    } catch (parseError) {
      console.error('[decodeGeoTIFF] Error parsing GeoTIFF from ArrayBuffer:');
      console.error('  - Error:', parseError instanceof Error ? parseError.message : parseError);
      if (parseError instanceof Error) {
        console.error('  - Stack:', parseError.stack);
      }
      throw new Error(
        `Failed to parse GeoTIFF: ${parseError instanceof Error ? parseError.message : String(parseError)}`
      );
    }

    let image;
    try {
      image = await tiff.getImage();
      console.log('[decodeGeoTIFF] Image extracted');
    } catch (imageError) {
      console.error('[decodeGeoTIFF] Error getting image from TIFF:');
      console.error('  - Error:', imageError instanceof Error ? imageError.message : imageError);
      if (imageError instanceof Error) {
        console.error('  - Stack:', imageError.stack);
      }
      throw new Error(`Failed to get image: ${imageError instanceof Error ? imageError.message : String(imageError)}`);
    }

    // Get image dimensions
    const width = image.getWidth();
    const height = image.getHeight();
    console.log('[decodeGeoTIFF] Image dimensions:', width, 'x', height);

    // Create ImageData for the canvas
    console.log('[decodeGeoTIFF] Creating ImageData...');
    const imageData = new ImageData(width, height);
    const data = imageData.data; // Uint8ClampedArray [R, G, B, A, R, G, B, A, ...]
    console.log('[decodeGeoTIFF] ImageData created, data length:', data.length);

    if (bandMode === 'rgb') {
      // Backend band layout (1-indexed): 1-3=RGB, 4=Grayscale, 5=Alpha
      // In 0-indexed samples:            0-2=RGB, 3=Grayscale,  4=Alpha
      console.log('[decodeGeoTIFF] Reading RGB bands (0, 1, 2) and alpha band (4)...');
      const redBand = await image.readRasters({ samples: [0] });
      const greenBand = await image.readRasters({ samples: [1] });
      const blueBand = await image.readRasters({ samples: [2] });
      const alphaBand = await image.readRasters({ samples: [4] });
      console.log('[decodeGeoTIFF] All bands read');

      const red = redBand[0] as Uint8Array | Uint16Array;
      const green = greenBand[0] as Uint8Array | Uint16Array;
      const blue = blueBand[0] as Uint8Array | Uint16Array;
      const alpha = alphaBand[0] as Uint8Array | Uint16Array;
      console.log(
        '[decodeGeoTIFF] Band data types:',
        red?.constructor?.name,
        green?.constructor?.name,
        blue?.constructor?.name,
        'alpha:',
        alpha?.constructor?.name
      );

      const isUint16 = red instanceof Uint16Array;
      const maxValue = isUint16 ? 65535 : 255;
      console.log('[decodeGeoTIFF] Data is', isUint16 ? '16-bit' : '8-bit', '(max value:', maxValue, ')');

      console.log('[decodeGeoTIFF] Filling ImageData with pixel values and alpha transparency...');
      let transparentPixels = 0;
      for (let i = 0; i < width * height; i++) {
        const r = isUint16 ? Math.round((red[i] / maxValue) * 255) : red[i];
        const g = isUint16 ? Math.round((green[i] / maxValue) * 255) : green[i];
        const b = isUint16 ? Math.round((blue[i] / maxValue) * 255) : blue[i];
        const a = alpha[i];

        data[i * 4] = r;
        data[i * 4 + 1] = g;
        data[i * 4 + 2] = b;
        data[i * 4 + 3] = a;

        if (a === 0) {
          transparentPixels++;
        }
      }
      console.log('[decodeGeoTIFF] ImageData filled, transparent pixels:', transparentPixels);
    } else {
      // Backend band layout (1-indexed): 4=Grayscale (normalized raw data), 5=Alpha
      // In 0-indexed samples:            3=Grayscale,                       4=Alpha
      console.log('[decodeGeoTIFF] Reading raw band (sample 3) and alpha band (sample 4)...');
      const rawBand = await image.readRasters({ samples: [3] });
      const alphaBand = await image.readRasters({ samples: [4] });
      const raw = rawBand[0] as Uint8Array | Uint16Array;
      const alpha = alphaBand[0] as Uint8Array | Uint16Array;
      console.log(
        '[decodeGeoTIFF] Raw band read, type:',
        raw?.constructor?.name,
        'alpha type:',
        alpha?.constructor?.name
      );

      const isUint16 = raw instanceof Uint16Array;
      const maxValue = isUint16 ? 65535 : 255;
      console.log('[decodeGeoTIFF] Data is', isUint16 ? '16-bit' : '8-bit');

      console.log('[decodeGeoTIFF] Filling ImageData with grayscale values and alpha transparency...');
      let transparentPixels = 0;
      for (let i = 0; i < width * height; i++) {
        const normalized = isUint16 ? Math.round((raw[i] / maxValue) * 255) : raw[i];
        const a = alpha[i];

        data[i * 4] = normalized;
        data[i * 4 + 1] = normalized;
        data[i * 4 + 2] = normalized;
        data[i * 4 + 3] = a;

        if (a === 0) {
          transparentPixels++;
        }
      }
      console.log('[decodeGeoTIFF] ImageData filled, transparent pixels:', transparentPixels);
    }

    // Convert ImageData to ImageBitmap for efficient rendering
    console.log('[decodeGeoTIFF] Creating ImageBitmap from ImageData...');
    const bitmap = await createImageBitmap(imageData);
    console.log('[decodeGeoTIFF] ImageBitmap created successfully');

    // Extract georeferencing bounds from the GeoTIFF's affine transform.
    // getBoundingBox() derives [west, south, east, north] from the embedded
    // ModelTiepoint + ModelPixelScale (or ModelTransformation) — this is the
    // authoritative source and accounts for the half-pixel correction applied
    // on the backend. Do NOT use the BOUNDS_WGS84 metadata tag.
    // Since the backend serves EPSG:3857 (Web Mercator), convert meters → WGS84
    // degrees for BitmapLayer (which expects longitude/latitude bounds).
    let bounds: [number, number, number, number] = [
      112.9, // west  - WGS84 fallback (Australia)
      -43.65, // south - WGS84 fallback
      153.65, // east  - WGS84 fallback
      -10.05 // north - WGS84 fallback
    ];

    try {
      const rawBounds = image.getBoundingBox() as [number, number, number, number];
      const geoKeys = image.getGeoKeys();
      const projCSType = geoKeys?.ProjectedCSTypeGeoKey as number | undefined;
      const geogCSType = geoKeys?.GeographicTypeGeoKey as number | undefined;

      if (projCSType === 3857) {
        // EPSG:3857 Web Mercator — convert meters to WGS84 degrees
        bounds = convertBoundsWebMercatorToWgs84(rawBounds);
        console.log('[decodeGeoTIFF] CRS: EPSG:3857, converted to WGS84:', bounds);
      } else if (geogCSType !== undefined) {
        // Geographic CRS (e.g. EPSG:4326 WGS84) — already in degrees
        bounds = rawBounds;
        console.log(`[decodeGeoTIFF] CRS: EPSG:${geogCSType} (geographic), using bounds as-is:`, bounds);
      } else {
        // Unknown CRS — use magnitude heuristic
        const [w, , e] = rawBounds;
        if (Math.abs(w) > 180 || Math.abs(e) > 180) {
          bounds = convertBoundsWebMercatorToWgs84(rawBounds);
          console.log('[decodeGeoTIFF] CRS unknown, bounds look like meters — assuming EPSG:3857, converted:', bounds);
        } else {
          bounds = rawBounds;
          console.log('[decodeGeoTIFF] CRS unknown, bounds look like degrees — using as-is:', bounds);
        }
      }
    } catch (boundsError) {
      console.warn('[decodeGeoTIFF] Could not read bounds from GeoTIFF metadata, using fallback:', boundsError);
    }

    return {
      bitmap,
      bounds
    };
  } catch (error) {
    console.error('[decodeGeoTIFF] Error decoding GeoTIFF:', error);
    throw error;
  }
}

/**
 * Generates a data URL from an ImageBitmap for use with BitmapLayer.
 * Note: This is a workaround since BitmapLayer can accept data URLs.
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
