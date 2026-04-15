'use client';

import { useAtom, useAtomValue } from 'jotai';
import { useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useHydrationAware } from '@/lib/hooks/useHydrationAware';

import {
  sampleClimateMvtColormapAtom,
  sampleClimateMvtAvailableColormapsAtom,
  sampleClimateMvtFetchColormapsAtom,
  type Colormap
} from '@/lib/atoms/sample-climate-mvt';

/**
 * SampleClimateMvtColormapSelector
 *
 * Dropdown selector to choose the colormap for climate data visualization.
 * Fetches available colormaps from the backend on mount.
 *
 * Colormaps are organized by type:
 * - Diverging: Best for anomalies and deviations
 * - Sequential: Best for measurements and rainfall
 * - Extended: Special purpose colormaps
 */
export function SampleClimateMvtColormapSelector() {
  const isHydrated = useHydrationAware();
  const [colormap, setColormap] = useAtom(sampleClimateMvtColormapAtom);
  const availableColormaps = useAtomValue(sampleClimateMvtAvailableColormapsAtom);
  const [, fetchColormaps] = useAtom(sampleClimateMvtFetchColormapsAtom);

  // Fetch available colormaps on mount
  useEffect(() => {
    fetchColormaps();
  }, [fetchColormaps]);

  if (!isHydrated || !availableColormaps) {
    return null;
  }

  const colormapList = Object.entries(availableColormaps.colormaps).sort(([nameA], [nameB]) =>
    nameA.localeCompare(nameB)
  );

  return (
    <div className="fixed bottom-52 right-4 z-20">
      <div className="bg-background/90 backdrop-blur-sm border border-border rounded-lg shadow-lg px-3 py-2 flex items-center gap-2">
        <label htmlFor="colormap-select" className="text-sm font-medium whitespace-nowrap">
          Colormap:
        </label>
        <Select value={colormap} onValueChange={(value) => setColormap(value as Colormap)}>
          <SelectTrigger id="colormap-select" className="w-40 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {colormapList.map(([name, description]) => (
              <SelectItem key={name} value={name} title={description}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {availableColormaps.colormaps[colormap as keyof typeof availableColormaps.colormaps] && (
          <span className="text-xs text-muted-foreground whitespace-nowrap ml-1">
            ({availableColormaps.colormaps[colormap as keyof typeof availableColormaps.colormaps]})
          </span>
        )}
      </div>
    </div>
  );
}
