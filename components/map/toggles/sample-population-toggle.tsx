'use client';

import { useAtom } from 'jotai';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';

import { samplePopulationVisibleAtom } from '@/lib/atoms/sample-population';

/**
 * SamplePopulationToggle
 * 
 * Button component to toggle the sample population layer visibility.
 */
export function SamplePopulationToggle() {
  const [visible, setVisible] = useAtom(samplePopulationVisibleAtom);

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setVisible(!visible)}
      className={`transition-colors backdrop-blur-sm ${
        visible
          ? 'bg-orange-500 border-orange-500 text-white'
          : 'bg-background/90'
      }`}
      aria-label="Toggle sample population layer"
      title="Toggle sample population layer"
    >
      {visible ? <Eye size={20} /> : <EyeOff size={20} />}
    </Button>
  );
}
