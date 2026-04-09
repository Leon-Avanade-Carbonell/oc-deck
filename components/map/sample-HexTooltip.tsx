'use client';

import { useAtom } from 'jotai';
import { sampleSelectedHexAtom } from '@/lib/atoms/sample-hex';

/**
 * SampleHexTooltip renders a floating tooltip showing hex data when a hex is clicked.
 *
 * - Appears at click coordinates
 * - Displays hex ID and population count
 * - Dismissible by clicking again or elsewhere
 */
export function SampleHexTooltip() {
  const [selectedHex, setSelectedHex] = useAtom(sampleSelectedHexAtom);

  if (!selectedHex) return null;

  return (
    <div
      className="fixed bg-white dark:bg-slate-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg p-3 z-50 pointer-events-auto"
      style={{
        left: `${selectedHex.x + 10}px`,
        top: `${selectedHex.y + 10}px`
      }}
      onClick={() => setSelectedHex(null)}
    >
      <div className="text-sm font-mono text-gray-700 dark:text-gray-300">
        <div className="font-semibold mb-1">Hex ID</div>
        <div className="break-all text-xs mb-2">{selectedHex.hexId}</div>
        <div className="font-semibold mb-1">Population</div>
        <div className="text-base font-bold text-blue-600 dark:text-blue-400">
          {selectedHex.population.toLocaleString()}
        </div>
      </div>
    </div>
  );
}
