import { atom } from 'jotai';
import { mapZoomAtom } from '@/lib/atoms/map';

export type Colormap =
  | 'vanimo'
  | 'berlin'
  | 'managua'
  | 'RdBu'
  | 'coolwarm'
  | 'BrBG'
  | 'PuOr'
  | 'viridis'
  | 'plasma'
  | 'inferno'
  | 'magma'
  | 'Blues'
  | 'YlGnBu'
  | 'YlOrRd'
  | 'turbo'
  | 'Spectral';

export type Stretch = 'linear' | 'sqrt' | 'log' | 'cbrt' | 'equalize' | 'percentile_2_98' | 'minmax';

export interface ColormapMetadata {
  default: string;
  colormaps: Record<string, string>;
  default_stretch: string;
  stretches: Record<string, string>;
}

/**
 * sampleClimateMvtAvailableColormapsAtom
 * Fetches available colormaps from backend and caches metadata
 */
export const sampleClimateMvtAvailableColormapsAtom = atom<ColormapMetadata | null>(null);

/**
 * Effect to fetch colormaps on initialization
 * This is a write-only atom that triggers the fetch
 */
export const sampleClimateMvtFetchColormapsAtom = atom(null, async (_get, set) => {
  try {
    const response = await fetch('/api/climate-mvt/colormaps');
    if (response.ok) {
      const data = (await response.json()) as ColormapMetadata;
      set(sampleClimateMvtAvailableColormapsAtom, data);
    }
  } catch (error) {
    console.error('[ClimateMVT] Failed to fetch available colormaps:', error);
  }
});

/**
 * sampleClimateMvtStretchAtom
 * Selects the stretch function for data value transformation before colormap application.
 * Default: 'equalize' (histogram equalization for balanced contrast)
 *
 * Available stretches:
 * - linear: No transformation
 * - sqrt: Square root transformation
 * - log: Logarithmic transformation
 * - cbrt: Cube root transformation
 * - equalize: Histogram equalization
 * - percentile_2_98: 2%-98% percentile stretch
 * - minmax: Min-max normalization
 */
export const sampleClimateMvtStretchAtom = atom<Stretch>('equalize');

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
 * sampleClimateMvtColormapAtom
 * Selects the colormap for rendering the climate data visualization.
 * Default: 'Blues' (sequential white → dark blue, intuitive for rainfall)
 *
 * Available colormaps:
 * - Diverging (best for anomalies): vanimo, berlin, managua, RdBu, coolwarm, BrBG, PuOr, Spectral
 * - Sequential (best for measurements): viridis, plasma, inferno, magma, Blues, YlGnBu, YlOrRd
 * - Extended rainbow: turbo (for depth/disparity data)
 */
export const sampleClimateMvtColormapAtom = atom<Colormap>('Blues');

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
 * Dynamically computed image URL based on variable, time, zoom level, colormap, and stretch.
 *
 * Backend serves pre-generated GeoTIFFs in Web Mercator (EPSG:3857) with
 * embedded georeferencing. DeckGL's BitmapLayer automatically reads the
 * projection and bounds from the GeoTIFF metadata.
 *
 * Colormap and stretch are passed as query parameters to control the visualization rendering.
 *
 * Examples:
 * - `/api/climate-mvt/monthly_rain/1989-01-16/z3.tif?colormap=RdBu&stretch=sqrt`
 * - `/api/climate-mvt/monthly_rain/1989-01-16/z3.tif?stretch=equalize` (uses default colormap)
 */
export const sampleClimateMvtImageUrlAtom = atom((get) => {
  const variable = get(sampleClimateMvtVariableAtom);
  const time = get(sampleClimateMvtTimeAtom);
  const zoom = get(sampleClimateMvtZoomAtom);
  const colormap = get(sampleClimateMvtColormapAtom);
  const stretch = get(sampleClimateMvtStretchAtom);

  // Extract only the date part if time includes a timestamp
  const dateOnly = time.split(' ')[0];
  const encodedTime = encodeURIComponent(dateOnly);

  // Construct URL through Next.js API proxy with colormap and stretch query parameters
  const baseUrl = `/api/climate-mvt/${variable}/${encodedTime}/z${zoom}.tif`;
  const params = new URLSearchParams();
  params.set('colormap', colormap);
  params.set('stretch', stretch);

  return `${baseUrl}?${params.toString()}`;
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
 * Read by the time picker to:
 * - Drive sequential playback (advance only after decode completes)
 * - Disable navigation controls when not playing (`isDecoding && !isPlaying`)
 *   covers manual steps, zoom-triggered reloads, and initial load.
 */
export const sampleClimateMvtIsDecodingAtom = atom<boolean>(false);
