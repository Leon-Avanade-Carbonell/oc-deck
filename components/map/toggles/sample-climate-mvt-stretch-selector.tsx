'use client';

import { useAtom, useAtomValue } from 'jotai';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useHydrationAware } from '@/lib/hooks/useHydrationAware';

import {
  sampleClimateMvtStretchAtom,
  sampleClimateMvtAvailableColormapsAtom,
  type Stretch
} from '@/lib/atoms/sample-climate-mvt';

/**
 * SampleClimateMvtStretchSelector
 *
 * Dropdown selector to choose the stretch function for climate data visualization.
 * Stretches transform the data values (0-1 range) before colormap application,
 * enhancing contrast and visibility for different data distributions.
 *
 * Available stretches:
 * - linear: No transformation (raw values)
 * - sqrt: Square root (brightens shadows)
 * - log: Logarithmic (good for wide dynamic ranges)
 * - cbrt: Cube root (gentler than sqrt)
 * - equalize: Histogram equalization (balances distribution)
 * - percentile_2_98: 2%-98% percentile stretch (clips extremes)
 * - minmax: Min-max normalization
 */
export function SampleClimateMvtStretchSelector() {
  const isHydrated = useHydrationAware();
  const [stretch, setStretch] = useAtom(sampleClimateMvtStretchAtom);
  const availableColormaps = useAtomValue(sampleClimateMvtAvailableColormapsAtom);

  if (!isHydrated || !availableColormaps?.stretches) {
    return null;
  }

  const stretchList = Object.entries(availableColormaps.stretches).sort(([nameA], [nameB]) =>
    nameA.localeCompare(nameB)
  );

  return (
    <div className="fixed bottom-20 right-4 z-20">
      <div className="bg-background/90 backdrop-blur-sm border border-border rounded-lg shadow-lg px-3 py-2 flex items-center gap-2">
        <label htmlFor="stretch-select" className="text-sm font-medium whitespace-nowrap">
          Stretch:
        </label>
        <Select value={stretch} onValueChange={(value) => setStretch(value as Stretch)}>
          <SelectTrigger id="stretch-select" className="w-40 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {stretchList.map(([name, description]) => (
              <SelectItem key={name} value={name} title={description}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {availableColormaps.stretches[stretch as keyof typeof availableColormaps.stretches] && (
          <span className="text-xs text-muted-foreground whitespace-nowrap ml-1">
            ({availableColormaps.stretches[stretch as keyof typeof availableColormaps.stretches]})
          </span>
        )}
      </div>
    </div>
  );
}
