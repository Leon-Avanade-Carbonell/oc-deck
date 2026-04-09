'use client';

import { useAtom } from 'jotai';
import { Hexagon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { sampleHexLayerVisibleAtom } from '@/lib/atoms/sample-hex';

/**
 * SampleHexToggle renders a button to toggle the visibility of the sample hex layer.
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
      size="sm"
      onClick={() => setVisible(!visible)}
      className="bg-background/90 backdrop-blur-sm"
    >
      <Hexagon className="mr-2 h-4 w-4" />
      {visible ? 'Hide' : 'Show'} Hex Sample
    </Button>
  );
}
