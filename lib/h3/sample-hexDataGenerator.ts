import * as h3 from 'h3-js';
import type { HexCell } from '@/lib/atoms/sample-hex';

/**
 * Australia polygon boundary (simplified) in GeoJSON format [lon, lat]
 * This is a rough approximation of Australia's coastline
 */
const AUSTRALIA_POLYGON = [
  [
    [113.0, -10.0], // NW
    [154.0, -10.0], // NE
    [154.0, -44.0], // SE
    [113.0, -44.0], // SW
    [113.0, -10.0] // Close the polygon
  ]
];

/**
 * Map zoom levels to H3 resolutions
 */
function getH3ResolutionForZoom(zoom: number): number {
  if (zoom <= 9) return 4; // Zoom 0-9: Resolution 4
  if (zoom <= 13) return 7; // Zoom 9-13: Resolution 7
  return 10; // Zoom 13+: Resolution 10
}

/**
 * Check if a point is within Australia bounds
 */
function isWithinAustraliaBounds(lat: number, lon: number): boolean {
  const minLon = 113.0;
  const maxLon = 154.0;
  const minLat = -44.0;
  const maxLat = -10.0;

  return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
}

/**
 * Generate H3 hex cells for a given zoom level and viewport bounds
 *
 * @param zoom Current map zoom level
 * @param viewportBounds Current visible map bounds as [minLon, minLat, maxLon, maxLat]
 *                       or null to use all of Australia
 */
export function generateHexCells(zoom: number, viewportBounds?: [number, number, number, number] | null): HexCell[] {
  const resolution = getH3ResolutionForZoom(zoom);

  // Determine the polygon to query
  // If viewport bounds provided, use only that area intersected with Australia
  // Otherwise, use all of Australia
  let queryPolygon: number[][][] = [AUSTRALIA_POLYGON[0]];

  if (viewportBounds) {
    const [minLon, minLat, maxLon, maxLat] = viewportBounds;

    // Clamp viewport to Australia bounds
    const clampedMinLon = Math.max(minLon, 113.0);
    const clampedMaxLon = Math.min(maxLon, 154.0);
    const clampedMinLat = Math.max(minLat, -44.0);
    const clampedMaxLat = Math.min(maxLat, -10.0);

    // Only query if the clamped bounds are valid and intersect Australia
    if (clampedMinLon < clampedMaxLon && clampedMinLat < clampedMaxLat) {
      queryPolygon = [
        [
          [clampedMinLon, clampedMinLat],
          [clampedMaxLon, clampedMinLat],
          [clampedMaxLon, clampedMaxLat],
          [clampedMinLon, clampedMaxLat],
          [clampedMinLon, clampedMinLat] // Close the polygon
        ]
      ];
    }
  }

  // Use polygonToCells to get all cells that intersect the query area
  const hexagons = h3.polygonToCells(queryPolygon, resolution, true);

  // Generate data for each hex cell
  const hexCells: HexCell[] = hexagons
    .filter((hexId) => {
      // Double-check that hex is within Australia bounds (polygon might include ocean)
      const [lat, lon] = h3.cellToLatLng(hexId);
      return isWithinAustraliaBounds(lat, lon);
    })
    .map((hexId) => {
      const boundary = h3.cellToBoundary(hexId, true); // true for GeoJSON format
      // boundary is [[lon, lat], [lon, lat], ...]
      // PolygonLayer expects geometry to be an array of rings: [[[lon, lat], ...]]
      const geometry = [boundary as [number, number][]];

      return {
        id: hexId,
        population: Math.floor(Math.random() * 100000), // 0-100k
        geometry
      };
    });

  return hexCells;
}
