import { atom } from 'jotai';
import { mapZoomAtom } from '@/lib/atoms/map';

export type BandMode = 'rgb' | 'raw';

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
 * - 'raw': Display band 4 (raw measurement values as grayscale)
 *
 * Note: Backend now serves fully-rendered GeoTIFFs. This atom is kept for
 * backwards compatibility with the band mode toggle UI, but is not used
 * by the layer rendering logic. Future: consider removing the toggle.
 */
export const sampleClimateMvtBandModeAtom = atom<BandMode>('rgb');

/**
 * sampleClimateMvtZoomAtom (derived)
 * Maps the current map zoom level to an appropriate COG zoom level (0-5).
 * Per backend guide: cogZoom = Math.min(Math.floor(mapZoom), 5)
 *
 * Zoom Level Mapping:
 * - z0: 256×256 (continental overview)
 * - z1: 512×512 (regional overview)
 * - z2: 1024×1024 (regional detail)
 * - z3: 2048×2048 (state level)
 * - z4: 4096×4096 (district level)
 * - z5: 8192×8192 (local area / max detail)
 *
 * z5 is the maximum; source climate grid has ~820×680 native data points.
 * Higher map zooms stay on z5 to avoid over-fetching large images.
 */
export const sampleClimateMvtZoomAtom = atom((get) => {
  const mapZoom = get(mapZoomAtom);
  const cogZoom = Math.min(Math.floor(mapZoom), 5);
  return cogZoom;
});

/**
 * sampleClimateMvtImageUrlAtom
 * Dynamically computed image URL based on variable, time, and zoom level.
 *
 * Backend serves pre-generated GeoTIFFs in Web Mercator (EPSG:3857) with
 * embedded georeferencing. DeckGL's BitmapLayer automatically reads the
 * projection and bounds from the GeoTIFF metadata.
 *
 * Example: `/api/climate-mvt/monthly_rain/1989-01-16/z3.tif`
 */
export const sampleClimateMvtImageUrlAtom = atom((get) => {
  const variable = get(sampleClimateMvtVariableAtom);
  const time = get(sampleClimateMvtTimeAtom);
  const zoom = get(sampleClimateMvtZoomAtom);

  // Extract only the date part if time includes a timestamp
  const dateOnly = time.split(' ')[0];
  const encodedTime = encodeURIComponent(dateOnly);

  // Construct URL through Next.js API proxy
  return `/api/climate-mvt/${variable}/${encodedTime}/z${zoom}.tif`;
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
 * sampleClimateMvtIsDecodingAtom
 * True while the layer is actively fetching or decoding a GeoTIFF.
 * Read by the time picker to drive sequential playback — the next
 * time step is only triggered after this becomes false.
 */
export const sampleClimateMvtIsDecodingAtom = atom<boolean>(false);
