'use client';

import { useAtom } from 'jotai';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';
import { useHydrationAware } from '@/lib/hooks/useHydrationAware';

import { sampleClimateMvtVisibleAtom } from '@/lib/atoms/sample-climate-mvt';

/**
 * SampleClimateMvtToggle
 *
 * Button component to toggle sample-climate-mvt layer visibility.
 */
export function SampleClimateMvtToggle() {
  const isHydrated = useHydrationAware();
  const [visible, setVisible] = useAtom(sampleClimateMvtVisibleAtom);

  if (!isHydrated) {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setVisible(!visible)}
      className={`transition-colors backdrop-blur-sm ${
        visible ? 'bg-orange-500 border-orange-500 text-white' : 'bg-background/90'
      }`}
      aria-label="Toggle sample-climate-mvt layer"
      title="Toggle sample-climate-mvt layer"
    >
      {visible ? <Eye size={20} /> : <EyeOff size={20} />}
    </Button>
  );
}
