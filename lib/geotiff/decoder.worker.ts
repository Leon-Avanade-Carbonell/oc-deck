/**
 * Web Worker for decoding GeoTIFF files off the main thread
 *
 * This worker handles GeoTIFF parsing and ImageBitmap creation,
 * which can be CPU-intensive. Running in a worker prevents
 * blocking the main thread's rendering.
 *
 * Message format (from main thread):
 * {
 *   id: string (unique request ID)
 *   arrayBuffer: ArrayBuffer (binary GeoTIFF data)
 *   bandMode: 'rgb' | 'raw'
 * }
 *
 * Response format (to main thread):
 * {
 *   id: string (matches request ID)
 *   success: boolean
 *   bitmap?: ImageBitmap (if success)
 *   bounds?: [number, number, number, number] (if success)
 *   error?: string (if failed)
 * }
 */

import { fromArrayBuffer } from 'geotiff';

export type BandMode = 'rgb' | 'raw';

interface DecodeWorkerMessage {
  id: string;
  arrayBuffer: ArrayBuffer;
  bandMode: BandMode;
}

interface DecodeWorkerResponse {
  id: string;
  success: boolean;
  bitmap?: ImageBitmap;
  bounds?: [number, number, number, number];
  error?: string;
}

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

async function decodeGeoTIFFInWorker(
  arrayBuffer: ArrayBuffer,
  bandMode: BandMode
): Promise<{ bitmap: ImageBitmap; bounds: [number, number, number, number] }> {
  // Parse the GeoTIFF file
  console.log('[Worker] Starting decode, arrayBuffer size:', arrayBuffer.byteLength);

  let tiff;
  try {
    tiff = await fromArrayBuffer(arrayBuffer);
    console.log('[Worker] GeoTIFF parsed successfully');
  } catch (parseError) {
    console.error('[Worker] Error parsing GeoTIFF from ArrayBuffer:');
    console.error('  - Error:', parseError instanceof Error ? parseError.message : parseError);
    throw new Error(
      `Failed to parse GeoTIFF: ${parseError instanceof Error ? parseError.message : String(parseError)}`
    );
  }

  let image;
  try {
    image = await tiff.getImage();
    console.log('[Worker] Image extracted');
  } catch (imageError) {
    console.error('[Worker] Error getting image from TIFF:');
    console.error('  - Error:', imageError instanceof Error ? imageError.message : imageError);
    throw new Error(`Failed to get image: ${imageError instanceof Error ? imageError.message : String(imageError)}`);
  }

  // Get image dimensions
  const width = image.getWidth();
  const height = image.getHeight();
  console.log('[Worker] Image dimensions:', width, 'x', height);

  // Create ImageData for the canvas
  console.log('[Worker] Creating ImageData...');
  const imageData = new ImageData(width, height);
  const data = imageData.data; // Uint8ClampedArray [R, G, B, A, R, G, B, A, ...]
  console.log('[Worker] ImageData created, data length:', data.length);

  if (bandMode === 'rgb') {
    console.log('[Worker] Reading RGB bands (0, 1, 2) and alpha band (3)...');
    // Extract RGB bands (0, 1, 2) and alpha band (3)
    const redBand = await image.readRasters({ samples: [0] });
    const greenBand = await image.readRasters({ samples: [1] });
    const blueBand = await image.readRasters({ samples: [2] });
    const alphaBand = await image.readRasters({ samples: [3] });
    console.log('[Worker] All bands read');

    const red = redBand[0] as Uint8Array | Uint16Array;
    const green = greenBand[0] as Uint8Array | Uint16Array;
    const blue = blueBand[0] as Uint8Array | Uint16Array;
    const alpha = alphaBand[0] as Uint8Array | Uint16Array;
    console.log(
      '[Worker] Band data types:',
      red?.constructor?.name,
      green?.constructor?.name,
      blue?.constructor?.name,
      'alpha:',
      alpha?.constructor?.name
    );

    // Determine if data is 8-bit or 16-bit
    const isUint16 = red instanceof Uint16Array;
    const maxValue = isUint16 ? 65535 : 255;
    console.log('[Worker] Data is', isUint16 ? '16-bit' : '8-bit', '(max value:', maxValue, ')');

    // Fill ImageData with RGB values and preserve alpha channel for transparency
    console.log('[Worker] Filling ImageData with pixel values and alpha transparency...');
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
    console.log('[Worker] ImageData filled, transparent pixels:', transparentPixels);
  } else {
    // Extract raw data band (typically band 0 for grayscale) and alpha band (band 3)
    console.log('[Worker] Reading raw band (sample 0) and alpha band (sample 3)...');
    const rawBand = await image.readRasters({ samples: [0] });
    const alphaBand = await image.readRasters({ samples: [3] });
    const raw = rawBand[0] as Uint8Array | Uint16Array;
    const alpha = alphaBand[0] as Uint8Array | Uint16Array;
    console.log('[Worker] Raw band read, type:', raw?.constructor?.name, 'alpha type:', alpha?.constructor?.name);

    // Determine if data is 8-bit or 16-bit
    const isUint16 = raw instanceof Uint16Array;
    const maxValue = isUint16 ? 65535 : 255;
    console.log('[Worker] Data is', isUint16 ? '16-bit' : '8-bit');

    // Fill ImageData with grayscale values and preserve alpha for transparency
    console.log('[Worker] Filling ImageData with grayscale values and alpha transparency...');
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
    console.log('[Worker] ImageData filled, transparent pixels:', transparentPixels);
  }

  // Convert ImageData to ImageBitmap for efficient rendering
  console.log('[Worker] Creating ImageBitmap from ImageData...');
  const bitmap = await createImageBitmap(imageData);
  console.log('[Worker] ImageBitmap created successfully');

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
  console.log('[Worker] Available GeoTIFF tags:', Object.keys(tags));

  // Check for BOUNDS_WGS84 tag mentioned in backend guide
  if (tags.BOUNDS_WGS84) {
    try {
      // BOUNDS_WGS84 should be a string like "[112.90, -43.65, 153.65, -10.05]"
      const boundsStr = tags.BOUNDS_WGS84.toString();
      console.log('[Worker] Found BOUNDS_WGS84 tag:', boundsStr);
      // Would need to parse if it's a string
    } catch (err) {
      console.warn('[Worker] Failed to parse BOUNDS_WGS84 tag:', err);
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
      console.log('[Worker] GeoTIFF Metadata:');
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
      console.warn('[Worker] Failed to extract bounds from metadata, using fallback:', err);
    }
  } else {
    console.warn('[Worker] No georeferencing metadata found in GeoTIFF');
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
}

// Listen for decode requests from the main thread
self.onmessage = async (event: MessageEvent<DecodeWorkerMessage>) => {
  const { id, arrayBuffer, bandMode } = event.data;

  console.log('[Worker] Received decode request:', id);

  try {
    const { bitmap, bounds } = await decodeGeoTIFFInWorker(arrayBuffer, bandMode);
    console.log('[Worker] Decode complete, sending response:', id);

    const response: DecodeWorkerResponse = {
      id,
      success: true,
      bitmap,
      bounds
    };

    // Transfer the bitmap to the main thread (not a copy, but a transfer)
    (self as any).postMessage(response, [bitmap]);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Worker] Decode failed:', errorMsg);
    if (error instanceof Error) {
      console.error('[Worker] Stack:', error.stack);
    }

    const response: DecodeWorkerResponse = {
      id,
      success: false,
      error: errorMsg
    };

    self.postMessage(response);
  }
};
