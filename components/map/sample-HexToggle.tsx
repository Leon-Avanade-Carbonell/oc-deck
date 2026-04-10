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
      variant={visible ? 'default' : 'outline'}
      size="icon"
      onClick={() => setVisible(!visible)}
      className="bg-background/90 backdrop-blur-sm"
      title={visible ? 'Hide Hex Sample' : 'Show Hex Sample'}
      aria-label={visible ? 'Hide Hex Sample' : 'Show Hex Sample'}
    >
      <Hexagon className="h-4 w-4" />
    </Button>
  );
}
