import { useAtom } from 'jotai';
import { useEffect, useRef } from 'react';

import {
  sampleClimateCurrentVariableAtom,
  sampleClimateCurrentTimeAtom,
  sampleClimateAvailableTimesAtom,
  sampleClimateDataCacheAtom,
  sampleClimateLoadingTimesAtom,
  sampleClimateErrorAtom
} from '@/lib/atoms/sample-climate';

// Use the Next.js API proxy instead of calling the backend directly
// This avoids CORS issues when the browser makes requests
const CLIMATE_API_BASE = '/api/climate';

interface UseClimateDataOptions {
  minLat?: number;
  maxLat?: number;
  minLon?: number;
  maxLon?: number;
}

/**
 * useClimateData
 *
 * Custom hook for discovering and fetching climate data from the Climate API.
 * This hook manages the discovery phase (variables and times).
 * Data fetching is triggered on-demand by the layer component.
 *
 * Workflow:
 * 1. Discover available variables on mount
 * 2. Auto-select first variable
 * 3. Discover available times for that variable
 * 4. Layer component fetches individual time slices on-demand
 * 5. Fetched data is cached to prevent re-fetching
 *
 * Data source: Climate API (proxied via /api/climate)
 *
 * Troubleshooting:
 * - If you see "Failed to fetch" error:
 *   1. Ensure Climate API is running: http://localhost:8000/climate/variables
 *   2. Check browser console for specific error message
 *   3. Verify no data in database: run ingestion notebook first
 *
 * - To use a different backend URL:
 *   Set CLIMATE_API_BASE environment variable (server-side only)
 *   Example: CLIMATE_API_BASE=http://remote-api.com/climate
 */
export function useClimateData() {
  const [currentVariable, setCurrentVariable] = useAtom(sampleClimateCurrentVariableAtom);
  const [currentTime, setCurrentTime] = useAtom(sampleClimateCurrentTimeAtom);
  const [, setAvailableTimes] = useAtom(sampleClimateAvailableTimesAtom);
  const [, setError] = useAtom(sampleClimateErrorAtom);

  // Step 1: Discover available variables on mount
  useEffect(() => {
    const discoverVariables = async () => {
      try {
        setError(null);
        const response = await fetch(`${CLIMATE_API_BASE}/variables`);

        if (!response.ok) {
          throw new Error(`Failed to fetch variables: ${response.statusText}`);
        }

        const { variables } = (await response.json()) as { variables: string[] };

        if (variables.length === 0) {
          throw new Error('No climate variables available in database');
        }

        // Auto-select first variable
        setCurrentVariable(variables[0]);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error discovering variables';
        setError(message);
        console.error('Climate API: Variable discovery failed', err);
      }
    };

    discoverVariables();
  }, [setCurrentVariable, setError]);

  // Step 2: Discover available times for current variable
  useEffect(() => {
    if (!currentVariable) return;

    const discoverTimes = async () => {
      try {
        setError(null);

        // Use cache-busting query param to ensure fresh data in development
        const url = `${CLIMATE_API_BASE}/times/${currentVariable}?t=${Date.now()}`;
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`Failed to fetch times for ${currentVariable}: ${response.statusText}`);
        }

        const { times } = (await response.json()) as { times: string[] };

        if (times.length === 0) {
          throw new Error(`No time steps available for variable: ${currentVariable}`);
        }

        console.log(`Climate API: Found ${times.length} time steps for ${currentVariable}`, times);
        setAvailableTimes(times);

        // Auto-select first time (only if not already set)
        if (!currentTime) {
          setCurrentTime(times[0]);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error discovering times';
        setError(message);
        console.error('Climate API: Time discovery failed', err);
      }
    };

    discoverTimes();
  }, [currentVariable, currentTime, setAvailableTimes, setCurrentTime, setError]);
}

/**
 * useClimateDataForTime
 *
 * Hook to fetch and cache grid data for a specific time slice.
 * Called by the layer component when the user selects a new time.
 *
 * Features:
 * - Returns immediately if data is already cached
 * - Prevents duplicate API calls via loadingTimes set
 * - Stores fetched data in cache for future use
 * - Enables instant switching between cached times (no flickering)
 */
export function useClimateDataForTime(variable: string, time: string, options: UseClimateDataOptions = {}) {
  const [cache, setCache] = useAtom(sampleClimateDataCacheAtom);
  const [loadingTimes, setLoadingTimes] = useAtom(sampleClimateLoadingTimesAtom);
  const [, setError] = useAtom(sampleClimateErrorAtom);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!variable || !time) return;

    // Check if already cached
    const cacheKey = `${variable}/${time}`;
    if (cache.has(cacheKey)) {
      return; // Data already loaded
    }

    // Check if already loading
    if (loadingTimes.has(cacheKey)) {
      return; // Already fetching this time
    }

    // Clear previous debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce time change (150ms) to avoid thrashing API
    debounceTimerRef.current = setTimeout(() => {
      const fetchGridData = async () => {
        try {
          setError(null);

          // Mark as loading
          setLoadingTimes((prev) => new Set([...prev, cacheKey]));

          // Build query parameters with bounding box (optional)
          const params = new URLSearchParams();

          if (options.minLat !== undefined) params.set('min_lat', String(options.minLat));
          if (options.maxLat !== undefined) params.set('max_lat', String(options.maxLat));
          if (options.minLon !== undefined) params.set('min_lon', String(options.minLon));
          if (options.maxLon !== undefined) params.set('max_lon', String(options.maxLon));

          const url = `${CLIMATE_API_BASE}/grid/${variable}/${time}${params.toString() ? `?${params.toString()}` : ''}`;

          const response = await fetch(url);

          if (!response.ok) {
            throw new Error(`Failed to fetch grid data for ${variable}/${time}: ${response.statusText}`);
          }

          const gridResponse = (await response.json()) as {
            data: {
              lats: number[];
              lons: number[];
              values: number[];
              count: number;
            };
          };

          if (gridResponse.data.count === 0) {
            console.warn('No data points returned from Climate API');
            setCache((prev) => new Map(prev).set(cacheKey, []));
            return;
          }

          // Transform to DeckGL ScatterplotLayer format: [lon, lat, value]
          const { lats, lons, values } = gridResponse.data;
          const positions: [number, number, number][] = lats.map((lat, i) => [lons[i], lat, values[i]]);

          // Store in cache
          setCache((prev) => new Map(prev).set(cacheKey, positions));
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error fetching grid data';
          setError(message);
          console.error('Climate API: Grid data fetch failed', err);
        } finally {
          // Mark as no longer loading
          setLoadingTimes((prev) => {
            const next = new Set(prev);
            next.delete(cacheKey);
            return next;
          });
        }
      };

      fetchGridData();
    }, 150);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [variable, time, cache, loadingTimes, options, setCache, setError, setLoadingTimes]);
}
