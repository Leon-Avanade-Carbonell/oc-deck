'use client';

import { fromArrayBuffer } from 'geotiff';

export type BandMode = 'rgb' | 'raw';

/**
 * Converts WGS84 coordinates (latitude, longitude in degrees) to Web Mercator (EPSG:3857)
 * Web Mercator uses meters for X and Y coordinates
 */
function wgs84ToWebMercator(lng: number, lat: number): [number, number] {
  const earthRadius = 6378137; // WGS84 semi-major axis in meters

  // Convert longitude to meters
  const x = ((lng * Math.PI) / 180) * earthRadius;

  // Convert latitude to meters using Mercator projection
  const y = Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 180 / 2)) * earthRadius;

  return [x, y];
}

/**
 * Converts a bounds array from WGS84 to Web Mercator
 * @param bounds [west, south, east, north] in WGS84 degrees
 * @returns [west, south, east, north] in Web Mercator meters
 */
function convertBoundsWgs84ToWebMercator(bounds: [number, number, number, number]): [number, number, number, number] {
  const [west, south, east, north] = bounds;

  // Convert corners
  const [westM] = wgs84ToWebMercator(west, 0);
  const [, southM] = wgs84ToWebMercator(0, south);
  const [eastM] = wgs84ToWebMercator(east, 0);
  const [, northM] = wgs84ToWebMercator(0, north);

  return [westM, southM, eastM, northM];
}

export interface GeoTIFFDecodedResult {
  bitmap: ImageBitmap;
  bounds: [number, number, number, number]; // [west, south, east, north]
}

/**
 * Decodes a GeoTIFF file and extracts bounds from metadata
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
 * Extracts georeferencing bounds from GeoTIFF metadata (ModelTiepoint + ModelPixelScale)
 * Bounds are returned in the same projection as the GeoTIFF (Web Mercator for this API)
 *
 * @param arrayBuffer - The binary GeoTIFF file data
 * @param bandMode - Which bands to display ('rgb' or 'raw')
 * @returns Promise<GeoTIFFDecodedResult> - ImageBitmap (with transparency) and bounds for BitmapLayer
 */
export async function decodeGeoTIFF(
  arrayBuffer: ArrayBuffer,
  bandMode: BandMode = 'rgb'
): Promise<GeoTIFFDecodedResult> {
  try {
    // Parse the GeoTIFF file
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
      // Extract RGB bands (0, 1, 2) and alpha band (3)
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

      // Determine if data is 8-bit or 16-bit
      const isUint16 = red instanceof Uint16Array;
      const maxValue = isUint16 ? 65535 : 255;
      console.log('[decodeGeoTIFF] Data is', isUint16 ? '16-bit' : '8-bit', '(max value:', maxValue, ')');

      // Fill ImageData with RGB values and preserve alpha channel for transparency
      console.log('[decodeGeoTIFF] Filling ImageData with pixel values and alpha transparency...');
      let transparentPixels = 0;
      for (let i = 0; i < width * height; i++) {
        const r = isUint16 ? Math.round((red[i] / maxValue) * 255) : red[i];
        const g = isUint16 ? Math.round((green[i] / maxValue) * 255) : green[i];
        const b = isUint16 ? Math.round((blue[i] / maxValue) * 255) : blue[i];
        // Alpha channel indicates transparency: 0=transparent (NaN), 255=opaque (valid data)
        const a = alpha[i];

        data[i * 4] = r; // R
        data[i * 4 + 1] = g; // G
        data[i * 4 + 2] = b; // B
        data[i * 4 + 3] = a; // A (preserve alpha: 0=transparent for NaN, 255=opaque for valid data)

        if (a === 0) {
          transparentPixels++;
        }
      }
      console.log('[decodeGeoTIFF] ImageData filled, transparent pixels:', transparentPixels);
    } else {
      // Extract raw data band (typically band 0 for grayscale) and alpha band (band 3)
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

      // Determine if data is 8-bit or 16-bit
      const isUint16 = raw instanceof Uint16Array;
      const maxValue = isUint16 ? 65535 : 255;
      console.log('[decodeGeoTIFF] Data is', isUint16 ? '16-bit' : '8-bit');

      // Fill ImageData with grayscale values and preserve alpha for transparency
      console.log('[decodeGeoTIFF] Filling ImageData with grayscale values and alpha transparency...');
      let transparentPixels = 0;
      for (let i = 0; i < width * height; i++) {
        const normalized = isUint16 ? Math.round((raw[i] / maxValue) * 255) : raw[i];
        const a = alpha[i];

        data[i * 4] = normalized; // R
        data[i * 4 + 1] = normalized; // G
        data[i * 4 + 2] = normalized; // B
        data[i * 4 + 3] = a; // A (preserve alpha: 0=transparent for NaN, 255=opaque for valid data)

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

    // Extract georeferencing bounds from GeoTIFF metadata
    // ModelTiepoint = [imageX, imageY, rasterX, geoX, geoY, geoZ]
    // ModelPixelScale = [scaleX, scaleY, scaleZ]
    // Bounds = [geoX, geoY - (height * scaleY), geoX + (width * scaleX), geoY]
    const geoTiff = (image as any).geoTiffData || {};

    let bounds: [number, number, number, number] = [
      112.85, // west - WGS84 fallback
      -43.65, // south - WGS84 fallback
      154.0, // east - WGS84 fallback
      -10.0 // north - WGS84 fallback
    ];

    // Try to read metadata tags first
    const tags = (image as any).getTags?.() || {};
    console.log('[decodeGeoTIFF] Available GeoTIFF tags:', Object.keys(tags));

    // Check for BOUNDS_WGS84 tag mentioned in backend guide
    if (tags.BOUNDS_WGS84) {
      try {
        // BOUNDS_WGS84 should be a string like "[112.90, -43.65, 153.65, -10.05]"
        const boundsStr = tags.BOUNDS_WGS84.toString();
        console.log('[decodeGeoTIFF] Found BOUNDS_WGS84 tag:', boundsStr);
        // Would need to parse if it's a string
      } catch (err) {
        console.warn('[decodeGeoTIFF] Failed to parse BOUNDS_WGS84 tag:', err);
      }
    }

    if (geoTiff?.ModelPixelScale && geoTiff?.ModelTiepoint) {
      try {
        const [pixelScaleX, pixelScaleY] = geoTiff.ModelPixelScale;
        const [, , , geoX, geoY] = geoTiff.ModelTiepoint;

        // Calculate bounds from GeoTIFF georeferencing
        const west = geoX;
        const north = geoY;
        const east = geoX + width * pixelScaleX;
        const south = geoY - height * pixelScaleY;

        bounds = [west, south, east, north];

        // Debug logging to diagnose coordinate system issues
        console.log('[decodeGeoTIFF] GeoTIFF Metadata:');
        console.log('  - Image size: %d x %d pixels', width, height);
        console.log('  - ModelPixelScale: [%f, %f]', pixelScaleX, pixelScaleY);
        console.log('  - ModelTiepoint origin: [%f, %f]', geoX, geoY);
        console.log('  - Extracted bounds: [%f, %f, %f, %f]', west, south, east, north);
        console.log('  - CRS from GeoTIFF:', tags.ModelPixelScale ? 'Present' : 'Missing');

        // Check if these look like WGS84 degrees or Web Mercator meters
        if (west > 1000000 && east > 1000000) {
          console.log('  ✓ Bounds appear to be Web Mercator (meters)');
        } else if (west > -180 && west < 180 && south > -90 && south < 90) {
          console.warn('  ✗ Bounds appear to be WGS84 (degrees), not Web Mercator!');
          console.warn('  Converting from WGS84 to Web Mercator on the frontend as workaround');

          // Convert WGS84 bounds to Web Mercator for frontend display
          bounds = convertBoundsWgs84ToWebMercator(bounds);
          console.log('  - Converted bounds to Web Mercator:', bounds);
        }
      } catch (err) {
        console.warn('[decodeGeoTIFF] Failed to extract bounds from metadata, using fallback:', err);
      }
    } else {
      console.warn('[decodeGeoTIFF] No georeferencing metadata found in GeoTIFF');
      console.warn('  - Has ModelPixelScale:', !!geoTiff?.ModelPixelScale);
      console.warn('  - Has ModelTiepoint:', !!geoTiff?.ModelTiepoint);
      if (geoTiff) {
        console.warn('  - Available geoTiffData keys:', Object.keys(geoTiff));
      }
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
