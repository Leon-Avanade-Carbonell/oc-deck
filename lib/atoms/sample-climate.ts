import { atom } from 'jotai';

/**
 * Climate grid data for current time slice
 * Format: [lon, lat, value]
 */
export const sampleClimateDataAtom = atom<[number, number, number][]>([]);

/**
 * Controls visibility of the climate layer
 */
export const sampleClimateVisibleAtom = atom(true);

/**
 * Currently selected climate variable (e.g., "monthly_rain")
 */
export const sampleClimateCurrentVariableAtom = atom<string>('');

/**
 * Currently selected time string (e.g., "1989-01")
 */
export const sampleClimateCurrentTimeAtom = atom<string>('');

/**
 * Array of available time strings for the current variable
 */
export const sampleClimateAvailableTimesAtom = atom<string[]>([]);

/**
 * Playback state: true = playing, false = stopped
 */
export const sampleClimatePlayingAtom = atom(false);

/**
 * Cache of previously-loaded time slices
 * Format: Map<timeString, gridData>
 *
 * This prevents flickering when switching between already-loaded times.
 * The layer populates this cache as times are loaded.
 */
export const sampleClimateDataCacheAtom = atom<Map<string, [number, number, number][]>>(new Map());

/**
 * Set of times currently being fetched
 * Prevents duplicate API calls for the same time
 */
export const sampleClimateLoadingTimesAtom = atom<Set<string>>(new Set<string>());

/**
 * Tracks whether API data is being fetched for discovery (variables/times)
 */
export const sampleClimateLoadingAtom = atom(false);

/**
 * Stores error message if API fetch fails
 */
export const sampleClimateErrorAtom = atom<string | null>(null);

/**
 * Current cell size (in meters) for the climate grid layer
 * Updates reactively based on map zoom level
 */
export const sampleClimateCellSizeAtom = atom(10000);
