# DeckGL Layer Creation Guide

A reference guide for AI agents creating new layers in this DeckGL+MapLibre visualization system.

## Quick Start (30 seconds)

All layers in this system follow the same pattern: **a component that returns the DeckGL layer configuration** wrapped by the `useSmartLayer` hook.

To find the right template for your layer, answer the **Decision Tree** questions below.

---

## Decision Tree

**Question 1: Does your layer need interactive features (picking, selection, tooltips)?**

- **NO** → Go to **Question 2**
- **YES** → Use **[Template B: Data + Interactivity Layer](#template-b-data--interactivity-layer)**

**Question 2: Does your layer render dynamic data (updates based on zoom, bounds, API calls, or time)?**

- **NO** → Use **[Template C: Simple Feature Layer](#template-c-simple-feature-layer)**
- **YES** → Use **[Template A: Data Layer](#template-a-data-layer)**

---

## Template A: Data Layer

**Use when:** Your layer renders data that changes dynamically (zoom-aware resolution, API calls, filtered by bounds, etc.)

**Features:** State management via Jotai atoms, memoized layer instance, visibility control

**Example scenarios:**
- Hexagons that change resolution based on zoom level
- Points filtered by geographic bounds
- Heatmap that updates from API data

```typescript
'use client';

import { useAtom } from 'jotai';
import { useMemo } from 'react';
import { GeoJsonLayer } from '@deck.gl/layers';
import { useSmartLayer } from '@/lib/hooks/useSmartLayer';

// Define atoms for your layer's state
import { myLayerDataAtom, myLayerVisibleAtom } from '@/lib/atoms/my-layer';

export function MyDataLayer() {
  const [data] = useAtom(myLayerDataAtom);
  const [visible] = useAtom(myLayerVisibleAtom);

  // Memoize the DeckGL layer instance
  const layer = useMemo(
    () =>
      new GeoJsonLayer({
        id: 'my-data-layer',
        data: visible ? data : [],
        stroked: true,
        filled: true,
        lineWidthMinPixels: 2,
        getLineColor: [0, 0, 0],
        getFillColor: [200, 150, 100],
        updateTriggers: {
          getLineColor: [data],
          getFillColor: [data],
        },
      }),
    [data, visible]
  );

  useSmartLayer(layer);

  return null; // Renders via DeckGL canvas, not DOM
}
```

**Key points:**
- Layer instance is memoized with `useMemo()` — only recreates when dependencies change
- `updateTriggers` tells DeckGL which properties to recalculate on the GPU
- Atoms control visibility and data; component reads both
- Return `null` — this component renders through the DeckGL canvas, not DOM
- Always pass empty array `[]` instead of data when `!visible` to avoid unnecessary GPU work

---

## Template B: Data + Interactivity Layer

**Use when:** Your layer needs picking (click detection), selection state, or tooltips

**Features:** Everything from Template A, plus picking via DeckGL overlay and selection state

**Example scenarios:**
- Hexagons that show details on click
- Points with hover highlighting
- GeoJSON features with selection UI

```typescript
'use client';

import { useAtom } from 'jotai';
import { useMemo } from 'react';
import { PolygonLayer } from '@deck.gl/layers';
import { useSmartLayer } from '@/lib/hooks/useSmartLayer';
import { useDeckGLOverlay } from '@/lib/hooks/useDeckGLOverlay';

import {
  myLayerDataAtom,
  myLayerVisibleAtom,
  myLayerSelectedAtom,
} from '@/lib/atoms/my-layer';

export function MyInteractiveLayer() {
  const [data] = useAtom(myLayerDataAtom);
  const [visible] = useAtom(myLayerVisibleAtom);
  const [selected, setSelected] = useAtom(myLayerSelectedAtom);
  const overlay = useDeckGLOverlay();

  const layer = useMemo(
    () =>
      new PolygonLayer({
        id: 'my-interactive-layer',
        data: visible ? data : [],
        stroked: true,
        filled: true,
        getLineColor: [0, 0, 0],
        getFillColor: (feature) =>
          selected && feature.id === selected.id
            ? [255, 140, 0] // Highlight on selection
            : [200, 150, 100],
        getLineWidth: (feature) =>
          selected && feature.id === selected.id ? 3 : 1,
        pickable: true,
        onClick: (info) => {
          if (info.object) {
            setSelected(info.object);
          }
        },
        updateTriggers: {
          getFillColor: [selected],
          getLineWidth: [selected],
        },
      }),
    [data, visible, selected, setSelected]
  );

  useSmartLayer(layer);

  return null;
}
```

**Key points:**
- `pickable: true` enables click detection
- `onClick` handler receives `info.object` with the picked feature
- `selected` state drives color/styling changes
- `getFillColor` is a function that can vary per feature based on selection state
- Dependencies include `selected` and `setSelected` (selection state)

---

## Template C: Simple Feature Layer

**Use when:** Your layer is static or only needs a visibility toggle (no data updates, no interaction)

**Features:** Minimal state, just visibility control

**Example scenarios:**
- User location marker (always same position)
- Reference grid or overlay
- Fixed annotations or labels

```typescript
'use client';

import { useAtom } from 'jotai';
import { useMemo } from 'react';
import { ScatterplotLayer } from '@deck.gl/layers';
import { useSmartLayer } from '@/lib/hooks/useSmartLayer';

import { mySimpleLayerVisibleAtom } from '@/lib/atoms/my-layer';

export function MySimpleLayer() {
  const [visible] = useAtom(mySimpleLayerVisibleAtom);

  const layer = useMemo(
    () =>
      new ScatterplotLayer({
        id: 'my-simple-layer',
        data: visible
          ? [
              { position: [151.2093, -33.8688], label: 'Sydney' },
              { position: [144.9631, -37.8136], label: 'Melbourne' },
            ]
          : [],
        getPosition: (d) => d.position,
        getRadius: 50000,
        getColor: [0, 128, 255],
        radiusScale: 1,
        radiusMinPixels: 4,
        radiusMaxPixels: 100,
      }),
    [visible]
  );

  useSmartLayer(layer);

  return null;
}
```

**Key points:**
- Only one dependency: `visible`
- Data is static (hardcoded in template) or minimal
- No `updateTriggers` needed for static data
- Still uses memoization for consistency

---

## Deep Dive: SampleHexLayer + SampleHexToggle

This section walks through a complete, production example showing how a complex data layer integrates with its UI controls.

### The Data Layer (SampleHexLayer)

This layer renders H3 hexagons with zoom-aware resolution and interactive selection.

```typescript
'use client';

import { useAtom } from 'jotai';
import { useEffect, useMemo, useRef } from 'react';
import { PolygonLayer } from '@deck.gl/layers';
import { useSmartLayer } from '@/lib/hooks/useSmartLayer';
import { useDeckGLOverlay } from '@/lib/hooks/useDeckGLOverlay';

import {
  sampleHexDataAtom,
  sampleSelectedHexAtom,
  sampleHexLayerVisibleAtom,
} from '@/lib/atoms/sample-hex';
import { mapZoomAtom } from '@/lib/atoms/map';

export function SampleHexLayer() {
  const [hexData] = useAtom(sampleHexDataAtom);
  const [visible] = useAtom(sampleHexLayerVisibleAtom);
  const [selected, setSelected] = useAtom(sampleSelectedHexAtom);
  const [zoom] = useAtom(mapZoomAtom);
  const overlay = useDeckGLOverlay();

  // Debounce data regeneration on zoom changes (150ms)
  const debounceTimerRef = useRef<NodeJS.Timeout>();
  useEffect(() => {
    clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      // Trigger hex data regeneration
      // (handled by separate hook that listens to mapZoomAtom)
    }, 150);
    return () => clearTimeout(debounceTimerRef.current);
  }, [zoom]);

  const layer = useMemo(
    () =>
      new PolygonLayer({
        id: 'sample-hex-layer',
        data: visible ? hexData : [],
        stroked: true,
        filled: true,
        getLineColor: [0, 0, 0, 255],
        getFillColor: (feature) => {
          // Color gradient: population determines RGB
          const pop = feature.population || 0;
          const normalized = Math.min(pop / 10000, 1); // Normalize to 0-1
          const green = Math.round(normalized * 255);
          return [200, green, 100, 255 * 0.7]; // 70% opacity
        },
        getLineWidth: (feature) =>
          selected && feature.id === selected.id ? 3 : 1,
        pickable: true,
        onClick: (info) => {
          if (info.object) {
            setSelected(info.object);
          }
        },
        updateTriggers: {
          getFillColor: [hexData],
          getLineWidth: [selected],
        },
      }),
    [hexData, visible, selected, setSelected]
  );

  useSmartLayer(layer);

  return null;
}
```

**Key design patterns:**
- **Zoom-aware data:** The `mapZoomAtom` triggers data regeneration; debouncing prevents thrashing
- **Color interpolation:** `getFillColor` is a function that calculates color per feature based on its population
- **Selection highlighting:** Selected hex gets thicker lines and stays highlighted
- **Performance:** `updateTriggers` ensures GPU only recalculates affected properties

### The Control Component (SampleHexToggle)

This simple component manages layer visibility.

```typescript
'use client';

import { useAtom } from 'jotai';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';

import { sampleHexLayerVisibleAtom } from '@/lib/atoms/sample-hex';

export function SampleHexToggle() {
  const [visible, setVisible] = useAtom(sampleHexLayerVisibleAtom);

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setVisible(!visible)}
      className={`transition-colors backdrop-blur-sm ${
        visible
          ? 'bg-orange-500 border-orange-500 text-white'
          : 'bg-background/90'
      }`}
      aria-label="Toggle hex layer"
      title="Toggle hex layer"
    >
      {visible ? <Eye size={20} /> : <EyeOff size={20} />}
    </Button>
  );
}
```

**Why this pattern works:**
- **Single responsibility:** Button only controls visibility
- **Decoupled from layer:** Toggle and layer don't import each other
- **Jotai atom as bridge:** Both read/write the same `sampleHexLayerVisibleAtom`
- **UI feedback:** Color changes indicate state; icon matches visibility state

### Integration in BaseMap

```typescript
// In your BaseMap or page component:
<BaseMap>
  <SampleHexLayer />
  {/* Other layers */}
</BaseMap>

// Controls in a separate floating panel:
<SampleHexToggle />
```

The `BaseMap` component automatically discovers and renders all layers that call `useSmartLayer()`. The toggle button is completely decoupled — it just writes to the atom that the layer reads.

---

## Reference / Appendix

### Common Jotai Patterns

**Define an atom:**

```typescript
import { atom } from 'jotai';

export const myLayerDataAtom = atom<MyDataType[]>([]);
export const myLayerVisibleAtom = atom(true);
export const myLayerSelectedAtom = atom<MySelectionType | null>(null);
```

**Read an atom:**

```typescript
const [data] = useAtom(myLayerDataAtom);
```

**Write an atom:**

```typescript
const [, setData] = useAtom(myLayerDataAtom);
setData(newData);
```

**Read and write in same component:**

```typescript
const [data, setData] = useAtom(myLayerDataAtom);
```

**Atoms should live in:** `lib/atoms/` directory, organized by feature (e.g., `lib/atoms/my-layer.ts`)

### Memoization & Performance

**Why memoize the layer?**

Creating a new DeckGL layer instance recreates GPU resources. Memoization prevents this unless dependencies actually change.

**Use `useMemo()` for:**
- The DeckGL layer instance itself
- Any expensive calculations (color functions, data transforms)

**Example:**

```typescript
const layer = useMemo(
  () =>
    new GeoJsonLayer({
      id: 'my-layer',
      data: visible ? data : [],
      // ... more props
    }),
  [data, visible] // Only recreate if data or visible changes
);
```

**Performance gotcha:**
- If you forget a dependency, the layer won't update when needed
- If you include too many dependencies, the layer recreates too often
- Aim for: dependencies = data that directly affects layer rendering

### Debouncing & Event Handling

**Debounce expensive operations on zoom/pan:**

```typescript
const debounceTimerRef = useRef<NodeJS.Timeout>();

useEffect(() => {
  clearTimeout(debounceTimerRef.current);
  debounceTimerRef.current = setTimeout(() => {
    // Expensive operation: regenerate data, recalculate bounds, etc.
    regenerateData();
  }, 150); // 150ms debounce

  return () => clearTimeout(debounceTimerRef.current);
}, [zoom, bounds]); // Re-run when zoom or bounds changes
```

**Why debounce?**
- Zoom events fire frequently (multiple times per scroll)
- Each event triggers data regeneration
- Debouncing batches them: only regenerate after 150ms of no changes

### Picking & Interactivity

**Enable picking on a layer:**

```typescript
new PolygonLayer({
  id: 'my-layer',
  pickable: true, // Required for clicking to work
  onClick: (info) => {
    if (info.object) {
      // info.object is the picked feature
      setSelected(info.object);
    }
  },
})
```

**Access the overlay for programmatic picking:**

```typescript
const overlay = useDeckGLOverlay();

// Later, if you need to pick something programmatically:
const pickedObject = overlay.pickObject({
  x: mouseX,
  y: mouseY,
  radius: 1,
});
```

**Picking events:**
- `onClick`: Fired on mouse click
- `onHover`: Fired on mouse move (be careful with performance)
- Always check `if (info.object)` before using it

### Styling & Color Mapping

**Static color:**

```typescript
getFillColor: [200, 150, 100] // RGB [0-255]
```

**Color with opacity:**

```typescript
getFillColor: [200, 150, 100, 255 * 0.7] // RGBA, opacity as 4th channel
```

**Dynamic color based on feature:**

```typescript
getFillColor: (feature) => {
  if (feature.population > 10000) return [0, 255, 0]; // Green
  if (feature.population > 5000) return [255, 255, 0]; // Yellow
  return [255, 0, 0]; // Red
}
```

**Color interpolation (linear mapping):**

```typescript
getFillColor: (feature) => {
  const pop = feature.population || 0;
  const normalized = Math.min(pop / 10000, 1); // 0 to 1
  const green = Math.round(normalized * 255);
  return [200, green, 100]; // Gradient from brown to greenish
}
```

**Use theme colors (from CSS variables):**

Most colors in this system use the theme defined in `app/theme.css`. For dynamic theme-aware colors, use CSS variables or store colors in Jotai atoms.

### Type Definitions

**Core types you'll encounter:**

```typescript
// From DeckGL
interface Layer {
  id: string;
  data: any[];
  [prop: string]: any;
}

// From this system (lib/map/types.ts)
interface LayerConfig {
  id: string;
  layer: Layer; // DeckGL layer instance
  visible: boolean;
}

// Picking info
interface PickInfo {
  object: any; // The feature you clicked on
  index: number; // Index in the data array
  x: number; // Screen coordinates
  y: number;
  layer: Layer;
}
```

### Imports Cheat Sheet

**Every layer component should import:**

```typescript
// React
import { useMemo, useRef, useEffect } from 'react';

// Jotai
import { useAtom } from 'jotai';

// DeckGL layers
import { PolygonLayer } from '@deck.gl/layers';
import { ScatterplotLayer } from '@deck.gl/layers';
import { GeoJsonLayer } from '@deck.gl/layers';
import { LineLayer } from '@deck.gl/layers';
import { IconLayer } from '@deck.gl/layers';

// System hooks
import { useSmartLayer } from '@/lib/hooks/useSmartLayer';
import { useDeckGLOverlay } from '@/lib/hooks/useDeckGLOverlay'; // Only if interactive

// System atoms
import { myLayerDataAtom } from '@/lib/atoms/my-layer';
```

### Troubleshooting

**Q: Layer is not rendering at all**
- Check 1: Is `visible` set to `true`?
- Check 2: Is `data` non-empty?
- Check 3: Are you calling `useSmartLayer(layer)` after creating the layer?
- Check 4: Is the layer properly passed as a child to `<BaseMap>`?
- Check 5: Are there console errors? Check browser DevTools.

**Q: Layer renders but data hasn't updated**
- Check 1: Did you add `data` to the `useMemo()` dependency array?
- Check 2: Is the Jotai atom being updated? Add a console.log in your data-generating hook.
- Check 3: Did you add the data to `updateTriggers`? Without it, GPU won't recalculate.

**Q: Clicking on the layer doesn't work**
- Check 1: Is `pickable: true` set on the layer?
- Check 2: Is the `onClick` handler defined?
- Check 3: Is `info.object` null? (Try `console.log(info.object)` in onClick handler.)
- Check 4: Are you sure you're clicking on the layer, not a transparent part?

**Q: Performance is sluggish**
- Check 1: Is `useMemo()` being used for the layer instance?
- Check 2: Are expensive functions (like `getFillColor`) defined inline? Move to `useMemo()` or extract outside component.
- Check 3: Is debouncing used for zoom/pan events? Add 150ms debounce.
- Check 4: Are you rendering too many features? Consider filtering data first.
- Check 5: Check DevTools Performance tab for bottlenecks.

**Q: Atom changes aren't triggering layer updates**
- Check 1: Are you using `useAtom()` to read the atom? (Proper hook.)
- Check 2: Is the atom being updated elsewhere? Add console.log on `setAtom`.
- Check 3: Is the atom included in the `useMemo()` dependency array?

---

## Checklist: Completed Layer

Use this checklist to validate your layer before marking it complete.

### Technical Requirements
- [ ] Layer is wrapped in `useSmartLayer()` call
- [ ] Layer instance is memoized with `useMemo()`
- [ ] All state lives in Jotai atoms (no `useState`)
- [ ] Layer is `pickable: true` (if interactive)
- [ ] `onClick` handler is defined (if interactive)
- [ ] `updateTriggers` includes all dynamic properties
- [ ] Visibility is controlled via a `*Visible` atom
- [ ] Component returns `null` (renders via canvas, not DOM)
- [ ] All dependencies in `useMemo()` are correct (console check)

### Naming & Conventions
- [ ] Component file: PascalCase (e.g., `MyCustomLayer.tsx`)
- [ ] Component file location: `components/map/layers/my-custom-layer.tsx`
- [ ] Atoms file location: `lib/atoms/my-custom-layer.ts`
- [ ] Atom names: camelCase + "Atom" suffix (e.g., `myCustomLayerDataAtom`)
- [ ] Layer ID: kebab-case (e.g., `id: 'my-custom-layer'`)
- [ ] Hook file location: `lib/hooks/use*.ts` (if you created helper hooks)

### Documentation
- [ ] Component has JSDoc comment explaining its purpose
- [ ] Atoms file has JSDoc comments for each atom
- [ ] Complex logic (color functions, debouncing) is commented
- [ ] README or documentation updated (if layer is public-facing)

### Integration
- [ ] Toggle/control component created (if layer visibility should be togglable)
- [ ] Toggle component reads/writes the `*Visible` atom
- [ ] Layer component is added as child to `<BaseMap>`
- [ ] Toggle component is placed in UI panel or header
- [ ] Tested: Layer renders when visible, hides when invisible
- [ ] Tested: Toggling works correctly

---

**Last Updated:** 2026-04-10
