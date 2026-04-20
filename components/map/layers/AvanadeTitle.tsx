'use client';

import { useAtomValue } from 'jotai';
import { avanadeTitleVisibleAtom } from '@/lib/atoms/avanade-title';

/**
 * AvanadeTitle
 *
 * A screen-centered DOM overlay displaying the event title in Avanade brand
 * colours. Renders above the map canvas via absolute positioning.
 *
 * Visibility is controlled by {@link avanadeTitleVisibleAtom}.
 * Pair with {@link AvanadeTitleToggle} to let users show/hide it.
 */
export function AvanadeTitle() {
  const visible = useAtomValue(avanadeTitleVisibleAtom);

  if (!visible) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
      <div
        className="flex flex-col items-center gap-3 px-10 py-6 select-none"
        style={{
          background: 'linear-gradient(135deg, rgba(0,0,0,0.3) 0%, rgba(20,20,20,0.3) 100%)',
          backdropFilter: 'blur(6px)',
          borderLeft: '4px solid #FF0000'
        }}
      >
        {/* Avanade wordmark accent line */}
        <div className="flex items-center gap-2 self-start">
          <span className="text-[40px] font-bold tracking-[0.25em] uppercase" style={{ color: '#FF0000' }}>
            Avanade
          </span>
          <span className="block h-px flex-1 w-8" style={{ background: '#FF0000' }} />
        </div>

        {/* Main event title */}
        <h1 className="text-9xl font-bold tracking-tight text-white text-center leading-tight">
          Data &amp; AI Tour <span style={{ color: '#FF0000' }}>2026</span>
        </h1>
      </div>
    </div>
  );
}
