import { atom } from 'jotai';
import { mapZoomAtom } from '@/lib/atoms/map';
import type { BandMode } from '@/lib/geotiff/decoder';

/**
 * sampleClimateMvtVariableAtom
 * Selected climate variable (e.g., 'monthly_rain', 'temperature')
 */
export const sampleClimateMvtVariableAtom = atom<string>('monthly_rain');

/**
 * sampleClimateMvtAvailableTimesAtom
 * Available times for the current variable
 */
export const sampleClimateMvtAvailableTimesAtom = atom<string[]>([
  '1989-01-16',
  '1989-02-15',
  '1989-03-16',
  '1989-04-16',
  '1989-05-16',
  '1989-06-16',
  '1989-07-16',
  '1989-08-16',
  '1989-09-16',
  '1989-10-16',
  '1989-11-16',
  '1989-12-16'
]);

/**
 * sampleClimateMvtTimeAtom
 * Selected time (date string, matching availableTimes format)
 */
export const sampleClimateMvtTimeAtom = atom<string>('1989-01-16');

/**
 * sampleClimateMvtBandModeAtom
 * Controls which GeoTIFF bands to display
 * - 'rgb': Display bands 0-2 (colored visual representation)
 * - 'raw': Display band 3 (raw measurement values as grayscale)
 */
export const sampleClimateMvtBandModeAtom = atom<BandMode>('rgb');

/**
 * sampleClimateMvtZoomAtom (derived)
 * Maps the current map zoom level to an appropriate COG zoom level (0-5).
 * Per backend guide:
 * - z0: 256×256 (zoom 0-2, continental overview)
 * - z1: 512×512 (zoom 3-4, regional overview)
 * - z2: 1024×1024 (zoom 5-6, regional detail)
 * - z3: 2048×2048 (zoom 7-10, state level)
 * - z4: 4096×4096 (zoom 11-13, district level)
 * - z5: 8192×8192 (zoom 14+, local area / max detail)
 *
 * This prevents over-fetching huge images at low zooms or under-using available detail at high zooms.
 */
export const sampleClimateMvtZoomAtom = atom((get) => {
  const mapZoom = get(mapZoomAtom);
  // Map continuous zoom to discrete COG levels (z0-z5)
  const cogZoom = Math.min(Math.max(Math.floor(mapZoom / 2.5), 0), 5);
  return cogZoom;
});

/**
 * sampleClimateMvtImageUrlAtom
 * Dynamically computed image URL based on variable, time, and zoom level
 * Uses the Next.js API proxy route to avoid CORS issues
 *
 * Example: `/api/climate-mvt/monthly_rain/1989-01-16/z3.tif`
 */
export const sampleClimateMvtImageUrlAtom = atom((get) => {
  const variable = get(sampleClimateMvtVariableAtom);
  const time = get(sampleClimateMvtTimeAtom);
  const zoom = get(sampleClimateMvtZoomAtom);

  // Extract only the date part if time includes a timestamp
  // (e.g., "1989-01-16" from "1989-01-16 12:00:00", or just "1989-01-16" if already date-only)
  const dateOnly = time.split(' ')[0];

  // URL-encode the date string
  const encodedTime = encodeURIComponent(dateOnly);

  // Construct the URL
  const url = `/api/climate-mvt/${variable}/${encodedTime}/z${zoom}.tif`;
  return url;
});

/**
 * sampleClimateMvtVisibleAtom
 * Controls layer visibility
 */
export const sampleClimateMvtVisibleAtom = atom(true);

/**
 * sampleClimateMvtHoveredValueAtom
 * Stores pixel value from raster on hover/pick
 */
export const sampleClimateMvtHoveredValueAtom = atom<number | null>(null);

/**
 * sampleClimateMvtBoundsAtom
 * Geographic bounds [west, south, east, north] for Australia coverage
 * Per backend guide: 112.85°E, -43.65°S to 154.0°E, -10.0°S
 */
export const sampleClimateMvtBoundsAtom = atom<[number, number, number, number]>([
  112.85, // west
  -43.65, // south
  154.0, // east
  -10.0 // north
]);
