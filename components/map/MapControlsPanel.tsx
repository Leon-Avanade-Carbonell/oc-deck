'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';
import { useHydrationAware } from '@/lib/hooks/useHydrationAware';
import { BasemapSelector } from './BasemapSelector';
import { SampleClimateMvtToggle } from './toggles/sample-climate-mvt-toggle';
import { SampleClimateMvtSettings } from './toggles/sample-climate-mvt-settings';

/**
 * MapControlsPanel
 *
 * A unified, collapsible floating panel docked to the top-left of the map.
 * Contains:
 * - Basemap selector
 * - Layer visibility toggles (e.g., sample-climate-mvt eye icon)
 * - Layer settings (e.g., colormap, stretch, opacity)
 *
 * The panel is collapsible via a toggle button (menu icon), allowing users to
 * keep the map clean when not adjusting controls.
 *
 * Uses ShadCN Card for consistent theming and the project's warm-gray palette.
 */
export function MapControlsPanel() {
  const isHydrated = useHydrationAware();
  const [isOpen, setIsOpen] = useState(true);

  if (!isHydrated) {
    return null;
  }

  return (
    <div className="absolute top-4 left-4 z-10">
      {/* Toggle button */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className="bg-background/90 backdrop-blur-sm"
        title={isOpen ? 'Collapse controls' : 'Expand controls'}
        aria-label={isOpen ? 'Collapse controls' : 'Expand controls'}
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </Button>

      {/* Floating controls card */}
      {isOpen && (
        <Card className="absolute top-12 left-0 mt-2 p-4 w-56 bg-background/95 backdrop-blur-sm border border-border shadow-lg">
          <div className="space-y-3">
            {/* Basemap selector */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-2 block">MAP</label>
              <BasemapSelector />
            </div>

            {/* Layers section */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-2 block">LAYERS</label>
              <div className="flex items-center gap-2">
                <SampleClimateMvtToggle />
                <span className="text-sm text-foreground">Climate Data</span>
              </div>
            </div>

            {/* Settings section */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-2 block">SETTINGS</label>
              <SampleClimateMvtSettings compact={true} />
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
