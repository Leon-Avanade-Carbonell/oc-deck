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
 * - 'rgb': Displays bands 0-2 (red, green, blue) as a visual colormap + band 3 (alpha) for transparency
 * - 'raw': Displays band 0 (grayscale raw data) as normalized 0-255 + band 3 (alpha) for transparency
 *
 * Transparency Support:
 * - NaN values in the data are represented as alpha=0 (transparent pixels)
 * - Valid data values have alpha=255 (opaque)
 * - When rendered on DeckGL, transparent pixels show the map background instead of blocking it
 *
 * Extracts georeferencing bounds using image.getBoundingBox() which reads the embedded CRS
 * (ModelTiepoint + ModelPixelScale or ModelTransformation). For WGS84 TIFs the returned
 * bounds are in degrees and can be passed directly to BitmapLayer.
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
      console.log('[decodeGeoTIFF] Reading RGB bands (0, 1, 2) and alpha band (3)...');
      const redBand = await image.readRasters({ samples: [0] });
      const greenBand = await image.readRasters({ samples: [1] });
      const blueBand = await image.readRasters({ samples: [2] });
      const alphaBand = await image.readRasters({ samples: [3] });
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
      console.log('[decodeGeoTIFF] Reading raw band (sample 0) and alpha band (sample 3)...');
      const rawBand = await image.readRasters({ samples: [0] });
      const alphaBand = await image.readRasters({ samples: [3] });
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

    // Extract georeferencing bounds using image.getBoundingBox().
    // Returns [west, south, east, north] in the file's native CRS.
    // We then detect the CRS via GeoKeys and convert to WGS84 degrees if needed,
    // since BitmapLayer.bounds always expects WGS84 (longitude/latitude degrees).
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
