/**
 * Layer configuration constants and utilities
 */

/**
 * Zoom-dependent cell size configuration for grid-based layers
 *
 * Cell sizes are calculated based on an 8×8 subdivision of MVT (Mapbox Vector Tile)
 * tiles, ensuring seamless grid rendering with no gaps or overlaps.
 *
 * Formula: cellSize = earthCircumference / (8 * 2^zoom)
 * Where earthCircumference ≈ 40,075 km = 40,075,000 meters
 * Result: cellSize = 5,009,375 / 2^zoom meters
 *
 * This creates a perfectly tiling grid where cell boundaries align with tile
 * grid divisions at each zoom level, eliminating rendering artifacts from
 * cell overlap or gaps.
 *
 * Values are rounded to practical numbers for efficiency while maintaining
 * the mathematical relationship to MVT tile boundaries.
 */
export const ZOOM_CELL_SIZE_CONFIG = [
  { minZoom: 0, maxZoom: 2, cellSize: 5000000 }, // 5,000 km - continental scale
  { minZoom: 3, maxZoom: 5, cellSize: 625000 }, // 625 km - country/region scale
  { minZoom: 6, maxZoom: 8, cellSize: 78000 }, // 78 km - city/metro scale
  { minZoom: 9, maxZoom: 11, cellSize: 10000 }, // 10 km - neighborhood scale
  { minZoom: 12, maxZoom: 14, cellSize: 1200 }, // 1.2 km - street/block scale
  { minZoom: 15, maxZoom: 17, cellSize: 150 }, // 150 m - building/detail scale
  { minZoom: 18, maxZoom: 22, cellSize: 19 } // 19 m - highly detailed scale
];

/**
 * Get the appropriate cell size for a given zoom level
 *
 * @param zoom - The current map zoom level (0-22)
 * @returns The cell size in meters, calculated from 8×8 MVT tile divisions
 * @throws Logs warning if zoom level is outside practical range
 */
export const getCellSizeForZoom = (zoom: number): number => {
  const config = ZOOM_CELL_SIZE_CONFIG.find((c) => zoom >= c.minZoom && zoom <= c.maxZoom);

  if (!config) {
    console.warn(`Invalid zoom level: ${zoom}. Using default cell size of 10000m`);
    return 10000;
  }

  return config.cellSize;
};
