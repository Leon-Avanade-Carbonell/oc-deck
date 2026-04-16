'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import { useHydrationAware } from '@/lib/hooks/useHydrationAware';
import { BasemapSelector } from './BasemapSelector';
import { SampleClimateMvtToggle } from './toggles/sample-climate-mvt-toggle';
import { SampleClimateMvtSettings } from './toggles/sample-climate-mvt-settings';

/**
 * MapControlsPanel
 *
 * A unified, side-drawer panel docked to the left of the map.
 * Provides a dashboard-like experience for map controls.
 * Contains:
 * - Basemap selector
 * - Layer visibility toggles (e.g., sample-climate-mvt eye icon)
 * - Layer settings (e.g., colormap, stretch, opacity)
 */
export function MapControlsPanel() {
  const isHydrated = useHydrationAware();

  if (!isHydrated) {
    return null;
  }

  return (
    <div className="absolute top-4 left-4 z-10">
      <Sheet defaultOpen={true} modal={false}>
        <SheetTrigger asChild>
          {/* Floating trigger button when closed */}
          <Button
            variant="outline"
            size="icon"
            className="bg-background/90 backdrop-blur-sm shadow-sm"
            title="Open map controls"
            aria-label="Open map controls"
          >
            <Menu size={20} />
          </Button>
        </SheetTrigger>

        {/* The side drawer */}
        <SheetContent
          side="left"
          className="w-[300px] sm:w-[350px] p-6 bg-background/95 backdrop-blur-md border-r shadow-2xl flex flex-col gap-6"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <SheetHeader className="text-left">
            <SheetTitle className="text-lg font-semibold text-foreground">Map Controls</SheetTitle>
          </SheetHeader>

          <div className="flex-1 space-y-8 overflow-y-auto pr-2">
            {/* Basemap selector */}
            <div className="space-y-3">
              <label className="text-xs font-bold tracking-wider text-muted-foreground uppercase">Basemap</label>
              <BasemapSelector />
            </div>

            {/* Layers section */}
            <div className="space-y-3">
              <label className="text-xs font-bold tracking-wider text-muted-foreground uppercase">Layers</label>
              <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
                <span className="text-sm font-medium text-foreground">Climate Data</span>
                <SampleClimateMvtToggle />
              </div>
            </div>

            {/* Settings section */}
            <div className="space-y-3">
              <label className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                Display Settings
              </label>
              <div className="p-3 border rounded-lg bg-muted/20">
                <SampleClimateMvtSettings compact={true} />
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
