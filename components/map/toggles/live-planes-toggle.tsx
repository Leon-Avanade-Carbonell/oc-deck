'use client';

import { useAtom } from 'jotai';
import { Eye, EyeOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { livePlanesVisibleAtom } from '@/lib/atoms/live-planes';

/**
 * LivePlanesToggle
 *
 * Button component to toggle the Live Planes layer visibility.
 * Reads and writes {@link livePlanesVisibleAtom}.
 */
export function LivePlanesToggle() {
  const [visible, setVisible] = useAtom(livePlanesVisibleAtom);

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
      aria-label="Toggle live planes layer"
      title="Toggle live planes layer"
    >
      {visible ? <Eye size={20} /> : <EyeOff size={20} />}
    </Button>
  );
}
