'use client';

import { useAtom } from 'jotai';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';

import { sampleClimateVisibleAtom } from '@/lib/atoms/sample-climate';

/**
 * SampleClimateToggle
 *
 * Button component to toggle the visibility of the climate layer.
 * Styled with theme colors and state-based styling.
 */
export function SampleClimateToggle() {
  const [visible, setVisible] = useAtom(sampleClimateVisibleAtom);

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setVisible(!visible)}
      className={`transition-colors backdrop-blur-sm ${
        visible
          ? 'bg-orange-500 border-orange-500 text-white hover:bg-orange-600'
          : 'bg-background/90 hover:bg-background'
      }`}
      aria-label="Toggle climate layer"
      title="Toggle climate layer visibility"
    >
      {visible ? <Eye size={20} /> : <EyeOff size={20} />}
    </Button>
  );
}
