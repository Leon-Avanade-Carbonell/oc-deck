'use client';

import React from 'react';
import { useAtom } from 'jotai';
import { Map } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { basemapAtom } from '@/lib/atoms/map';
import { BASETILES_LIST } from '@/lib/map/basetiles';
import type { BasemapId } from '@/lib/map/types';

/**
 * BasemapSelector renders a dropdown to switch between available OSM basemap tiles.
 *
 * Reads from and writes to `basemapAtom`. BaseMap automatically re-renders with
 * the new tile style when the atom changes.
 *
 * This component is intentionally decoupled from BaseMap — place it anywhere
 * in the UI (toolbar, sidebar, floating panel, etc.).
 *
 * ## Usage
 * ```tsx
 * <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}>
 *   <BasemapSelector />
 * </div>
 * ```
 *
 * ## Adding more basemaps
 * Add entries to `lib/map/basetiles.ts` and update the `BasemapId` union in
 * `lib/map/types.ts`. The selector will automatically include them.
 */
export function BasemapSelector() {
  const [basemapId, setBasemapId] = useAtom(basemapAtom);

  return (
    <Select value={basemapId} onValueChange={(v) => setBasemapId(v as BasemapId)}>
      <SelectTrigger className="w-40 bg-background/90 backdrop-blur-sm">
        <Map className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
        <SelectValue placeholder="Basemap" />
      </SelectTrigger>
      <SelectContent>
        {BASETILES_LIST.map((tile) => (
          <SelectItem key={tile.id} value={tile.id}>
            {tile.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
