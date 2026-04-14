'use client';

import { useAtom } from 'jotai';
import { Button } from '@/components/ui/button';
import { Palette, Zap } from 'lucide-react';
import { useHydrationAware } from '@/lib/hooks/useHydrationAware';
import { sampleClimateMvtBandModeAtom } from '@/lib/atoms/sample-climate-mvt';

/**
 * SampleClimateMvtBandModeToggle
 *
 * Toggles between two display modes for the climate layer:
 * - RGB: Displays colored visual representation (bands 0-2)
 * - Raw: Displays grayscale raw measurement data (band 3)
 */
export function SampleClimateMvtBandModeToggle() {
  const isHydrated = useHydrationAware();
  const [bandMode, setBandMode] = useAtom(sampleClimateMvtBandModeAtom);

  if (!isHydrated) {
    return null;
  }

  const toggleMode = () => {
    setBandMode((prev) => (prev === 'rgb' ? 'raw' : 'rgb'));
  };

  const isRgb = bandMode === 'rgb';

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggleMode}
      className={`transition-colors backdrop-blur-sm ${
        isRgb ? 'bg-blue-500 border-blue-500 text-white' : 'bg-amber-500 border-amber-500 text-white'
      }`}
      aria-label="Toggle band mode"
      title={isRgb ? 'Showing RGB visual - click for raw data' : 'Showing raw data - click for RGB visual'}
    >
      {isRgb ? <Palette size={20} /> : <Zap size={20} />}
    </Button>
  );
}
