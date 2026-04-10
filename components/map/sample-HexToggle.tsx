'use client';

import { useAtom } from 'jotai';
import { Hexagon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { sampleHexLayerVisibleAtom } from '@/lib/atoms/sample-hex';

/**
 * SampleHexToggle renders an icon button to toggle the visibility of the sample hex layer.
 *
 * Reads from and writes to `sampleHexLayerVisibleAtom`.
 *
 * ## Usage
 * ```tsx
 * <div style={{ position: 'absolute', top: 16, right: 200, zIndex: 10 }}>
 *   <SampleHexToggle />
 * </div>
 * ```
 */
export function SampleHexToggle() {
  const [visible, setVisible] = useAtom(sampleHexLayerVisibleAtom);

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setVisible(!visible)}
      className={`backdrop-blur-sm transition-colors ${
        visible
          ? 'bg-orange-500 hover:bg-orange-600 text-white border-orange-600'
          : 'bg-background/90'
      }`}
      title={visible ? 'Hide Hex Sample' : 'Show Hex Sample'}
      aria-label={visible ? 'Hide Hex Sample' : 'Show Hex Sample'}
    >
      <Hexagon className="h-4 w-4" />
    </Button>
  );
}
