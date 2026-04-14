'use client';

import { useAtom } from 'jotai';
import { useHydrationAware } from '@/lib/hooks/useHydrationAware';
import {
  sampleClimateMvtVariableAtom,
  sampleClimateMvtTimeAtom,
  sampleClimateMvtImageUrlAtom
} from '@/lib/atoms/sample-climate-mvt';

/**
 * Debug component to display current atom values
 * Only renders after hydration to avoid mismatches
 * Remove this component after debugging
 */
export function ClimateMvtDebug() {
  const isHydrated = useHydrationAware();
  const [variable] = useAtom(sampleClimateMvtVariableAtom);
  const [time] = useAtom(sampleClimateMvtTimeAtom);
  const [url] = useAtom(sampleClimateMvtImageUrlAtom);

  // Don't render during hydration
  if (!isHydrated) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 60,
        left: 4,
        background: '#1a1a1a',
        color: '#00ff00',
        padding: '12px',
        borderRadius: '4px',
        fontFamily: 'monospace',
        fontSize: '11px',
        zIndex: 1000,
        maxWidth: '500px',
        border: '1px solid #00ff00'
      }}
    >
      <div>variable: {variable}</div>
      <div>time: {time}</div>
      <div>url: {url}</div>
    </div>
  );
}
