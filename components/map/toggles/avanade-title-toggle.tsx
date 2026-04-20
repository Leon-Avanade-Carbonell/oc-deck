'use client';

import { useAtom } from 'jotai';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { avanadeTitleVisibleAtom } from '@/lib/atoms/avanade-title';

/**
 * AvanadeTitleToggle
 *
 * Button component to toggle the AvanadeTitle overlay visibility.
 */
export function AvanadeTitleToggle() {
  const [visible, setVisible] = useAtom(avanadeTitleVisibleAtom);

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setVisible(!visible)}
      className={`transition-colors backdrop-blur-sm ${
        visible
          ? 'border-[#FF0000] text-white'
          : 'bg-background/90'
      }`}
      style={visible ? { background: '#FF0000' } : undefined}
      aria-label="Toggle Avanade title overlay"
      title="Toggle Avanade title overlay"
    >
      {visible ? <Eye size={20} /> : <EyeOff size={20} />}
    </Button>
  );
}
