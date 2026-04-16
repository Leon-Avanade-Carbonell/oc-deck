'use client';

import { useAtom, useAtomValue } from 'jotai';
import { useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useHydrationAware } from '@/lib/hooks/useHydrationAware';

import {
  sampleClimateMvtSettingsAtom,
  sampleClimateMvtAvailableColormapsAtom,
  sampleClimateMvtFetchColormapsAtom,
  type ClimateMvtSettings,
  type Colormap,
  type Stretch
} from '@/lib/atoms/sample-climate-mvt';

/**
 * SampleClimateMvtSettings
 *
 * Unified settings component for climate MVT layer visualization.
 * Provides controls for:
 * - Colormap selection (dropdown)
 * - Stretch function selection (dropdown)
 * - Opacity adjustment (slider)
 *
 * Settings are staged in local state and only applied to the global atom
 * when the user clicks "Save", preventing unnecessary API calls and map updates
 * while the user is exploring options.
 *
 * UI: Popover accessible via a Settings (gear icon) button.
 */
export function SampleClimateMvtSettings() {
  const isHydrated = useHydrationAware();
  const [globalSettings, setGlobalSettings] = useAtom(sampleClimateMvtSettingsAtom);
  const availableColormaps = useAtomValue(sampleClimateMvtAvailableColormapsAtom);
  const [, fetchColormaps] = useAtom(sampleClimateMvtFetchColormapsAtom);

  // Local form state — staged changes before save
  // Only initialized when popover opens, reverts to global settings on close/cancel
  const [formSettings, setFormSettings] = useState<ClimateMvtSettings | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Fetch available colormaps on mount
  useEffect(() => {
    fetchColormaps();
  }, [fetchColormaps]);

  // Handle opening/closing popover
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      // Initialize form with current global settings when opening
      setFormSettings(globalSettings);
    } else {
      // Clear form when closing
      setFormSettings(null);
    }
  };

  if (!isHydrated || !availableColormaps || !formSettings || !isOpen) {
    return (
      <div className="fixed top-20 right-4 z-10">
        {/* Settings button */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => handleOpenChange(true)}
          title="Climate MVT layer settings"
          aria-label="Climate MVT layer settings"
        >
          <Settings className="size-4" />
        </Button>
      </div>
    );
  }

  const colormapList = Object.entries(availableColormaps.colormaps).sort(([nameA], [nameB]) =>
    nameA.localeCompare(nameB)
  );

  const stretchList = Object.entries(availableColormaps.stretches).sort(([nameA], [nameB]) =>
    nameA.localeCompare(nameB)
  );

  const handleSave = () => {
    if (formSettings) {
      setGlobalSettings(formSettings);
    }
    handleOpenChange(false);
  };

  const handleCancel = () => {
    handleOpenChange(false);
  };

  return (
    <div className="fixed top-20 right-4 z-10">
      {/* Settings button */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => handleOpenChange(!isOpen)}
        title="Climate MVT layer settings"
        aria-label="Climate MVT layer settings"
      >
        <Settings className="size-4" />
      </Button>

      {/* Popover panel */}
      {isOpen && formSettings && (
        <div className="absolute right-0 top-12 mt-1 bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-4 w-72">
          <div className="space-y-4">
            {/* Colormap selector */}
            <div className="space-y-2">
              <label htmlFor="colormap-select" className="text-sm font-medium">
                Colormap
              </label>
              <Select
                value={formSettings.colormap}
                onValueChange={(value) => setFormSettings({ ...formSettings, colormap: value as Colormap })}
              >
                <SelectTrigger id="colormap-select" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {colormapList.map(([name, description]) => (
                    <SelectItem key={name} value={name} title={description}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableColormaps.colormaps[formSettings.colormap as keyof typeof availableColormaps.colormaps] && (
                <p className="text-xs text-muted-foreground">
                  {availableColormaps.colormaps[formSettings.colormap as keyof typeof availableColormaps.colormaps]}
                </p>
              )}
            </div>

            {/* Stretch selector */}
            <div className="space-y-2">
              <label htmlFor="stretch-select" className="text-sm font-medium">
                Stretch
              </label>
              <Select
                value={formSettings.stretch}
                onValueChange={(value) => setFormSettings({ ...formSettings, stretch: value as Stretch })}
              >
                <SelectTrigger id="stretch-select" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stretchList.map(([name, description]) => (
                    <SelectItem key={name} value={name} title={description}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableColormaps.stretches[formSettings.stretch as keyof typeof availableColormaps.stretches] && (
                <p className="text-xs text-muted-foreground">
                  {availableColormaps.stretches[formSettings.stretch as keyof typeof availableColormaps.stretches]}
                </p>
              )}
            </div>

            {/* Opacity slider */}
            <div className="space-y-2">
              <label htmlFor="opacity-slider" className="text-sm font-medium">
                Opacity: {Math.round(formSettings.opacity * 100)}%
              </label>
              <input
                id="opacity-slider"
                type="range"
                min="0"
                max="100"
                value={Math.round(formSettings.opacity * 100)}
                onChange={(e) => setFormSettings({ ...formSettings, opacity: parseInt(e.target.value) / 100 })}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0%</span>
                <span>100%</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
              <Button variant="default" size="sm" onClick={handleSave} className="flex-1">
                Save
              </Button>
              <Button variant="outline" size="sm" onClick={handleCancel} className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
