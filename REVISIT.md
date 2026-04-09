# REVISIT.md — BaseMap Component Architecture

> **Purpose**: This document is written for AI agents and developers to understand pending implementation details, architectural decisions, and deferred work items for the BaseMap component.
>
> **Status**: Core implementation complete. Items below are deferred by design.

---

## Architecture Overview

The BaseMap system is built on:

- **MapLibre GL** (via `react-map-gl/maplibre`) — map rendering
- **DeckGL** (`@deck.gl/mapbox` overlay) — data visualization layers
- **Jotai** — global atom-based state management
- **React 19 / Next.js App Router** — client components with `'use client'`

### Key File Locations

```
components/
└── map/
    ├── BaseMap.tsx              # Main map component (C3 responsive sizing)
    ├── DeckGLOverlay.tsx        # Internal DeckGL overlay using useControl
    ├── BasemapSelector.tsx      # External control for tile switching
    └── layers/
        └── CurrentLocationLayer.tsx  # ScatterplotLayer for user location

lib/
├── atoms/
│   └── map.ts                   # All Jotai atoms (mapInstance, overlay, layers, basemap, location)
├── hooks/
│   ├── useMapInitialization.ts  # Writes MapLibre map instance to atom
│   ├── useDeckGLOverlay.ts      # Reads deckglOverlayAtom — for advanced layer access
│   └── useSmartLayer.ts         # Hook template for all custom layers
└── map/
    ├── types.ts                 # LayerConfig, MapControls, MapViewport, BasemapId
    ├── config.ts                # DEFAULT_BASEMAP, DEFAULT_VIEWPORT, DEFAULT_CONTROLS
    └── basetiles.ts             # Basemap tile URL registry
```

---

## How to Create a New Layer Using `useSmartLayer`

Every custom layer should follow this pattern:

### 1. Create a new file in `components/map/layers/`

```tsx
'use client';

import { useMemo } from 'react';
import { ScatterplotLayer } from '@deck.gl/layers';
import { useSmartLayer } from '@/lib/hooks/useSmartLayer';

export function MyCustomLayer() {
  // Build the DeckGL layer instance (memoized to avoid unnecessary atom updates)
  const layer = useMemo(
    () =>
      new ScatterplotLayer({
        id: 'my-custom-layer',
        data: [{ position: [138.6007, -34.9285] }],
        getPosition: (d) => d.position,
        getRadius: 100,
        getFillColor: [255, 0, 128]
      }),
    [] // add data dependencies here
  );

  // Register the layer — handles add on mount, update on change, remove on unmount
  useSmartLayer({
    id: 'my-custom-layer',
    layer,
    label: 'My Custom Layer' // shown in layer controls UI
  });

  return null; // layers render via DeckGL, not the DOM
}
```

### 2. Use it inside `<BaseMap>`

```tsx
import { BaseMap } from '@/components/map/BaseMap';
import { MyCustomLayer } from '@/components/map/layers/MyCustomLayer';

export default function Page() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <BaseMap>
        <MyCustomLayer />
      </BaseMap>
    </div>
  );
}
```

### 3. Control layer visibility externally

Visibility is stored in `layersAtom` as a `visible: boolean` flag on each entry.

To toggle visibility from outside the layer:

```tsx
import { useAtom } from 'jotai';
import { layersAtom } from '@/lib/atoms/map';

function LayerControls() {
  const [layers, setLayers] = useAtom(layersAtom);

  const toggle = (id: string) => {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)));
  };

  return (
    <ul>
      {layers.map((l) => (
        <li key={l.id}>
          <input type="checkbox" checked={l.visible} onChange={() => toggle(l.id)} />
          {l.label}
        </li>
      ))}
    </ul>
  );
}
```

### `useSmartLayer` Return Value

`useSmartLayer` returns a `setVisible(visible: boolean)` helper for inline toggle without touching atoms directly:

```tsx
const { setVisible } = useSmartLayer({ id, layer, label });
setVisible(false); // hides the layer
```

---

## REVISIT Items

### 1. Error Handling Strategy

**Status**: Not implemented  
**Questions to resolve**:

- What happens when the MapLibre map fails to load (network error, style not found)?
- How should layer creation errors surface to the user?
- Should there be a `MapErrorBoundary` component wrapping BaseMap?

**Recommended approach**:

- Wrap `<Map>` (react-map-gl) with a React `ErrorBoundary`
- Use the `onError` prop on `<Map>` to capture MapLibre errors
- Show a fallback UI with a retry button
- Log layer errors inside `useSmartLayer`'s useEffect with a try/catch

---

### 2. Performance Considerations

**Status**: Not benchmarked  
**Questions to resolve**:

- What is the maximum layer count before frame rate drops below 60fps?
- What is the maximum feature count per ScatterplotLayer?
- Should large datasets use DeckGL's `DataFilterExtension` or `MVTLayer` for server-side filtering?

**Recommended approach**:

- Profile at 10, 50, 100 layers
- Use `@deck.gl/extensions` `DataFilterExtension` for attribute-based filtering
- For >10k features, consider clustering with `@deck.gl/aggregation-layers`

---

### 3. Geolocation Implementation

**Status**: `currentLocationAtom` exists but is never populated  
**What's needed**:

Create `lib/hooks/useUserLocation.ts`:

```typescript
// lib/hooks/useUserLocation.ts
'use client';

import { useEffect } from 'react';
import { useSetAtom } from 'jotai';
import { currentLocationAtom } from '@/lib/atoms/map';

export function useUserLocation() {
  const setLocation = useSetAtom(currentLocationAtom);

  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => setLocation([pos.coords.longitude, pos.coords.latitude]),
      (err) => console.warn('Geolocation error:', err),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [setLocation]);
}
```

Call this hook anywhere in the app (e.g., in the page that uses `<BaseMap>`) to start populating `currentLocationAtom`. `CurrentLocationLayer` will automatically react to it.

**Permission handling**: Add a UI prompt when `err.code === GeolocationPositionError.PERMISSION_DENIED`.

---

### 4. Mobile Responsiveness

**Status**: Not tested on mobile  
**Questions to resolve**:

- Should pitch/rotate controls be enabled on mobile (pinch gesture)?
- Are layer control buttons large enough for touch targets (min 44×44px)?
- Should the `BasemapSelector` collapse to a bottom sheet on small screens?

**Recommended approach**:

- Test with Chrome DevTools device emulation
- Use Tailwind `md:` breakpoints for control layouts
- Consider ShadCN `Sheet` component for mobile-friendly layer panel

---

### 5. Layer Data Fetching

**Status**: Not implemented  
**Pattern to follow when needed**:

Layers that need remote data should:

1. Define a Jotai atom for the data: `myLayerDataAtom = atom<Feature[]>([])`
2. Fetch data in a hook or server action and write to atom
3. The layer reads from the atom and passes to DeckGL:

```tsx
const data = useAtomValue(myLayerDataAtom);
const layer = useMemo(
  () => new ScatterplotLayer({ id: 'my-layer', data, ... }),
  [data]
);
useSmartLayer({ id: 'my-layer', layer, label: 'My Layer' });
```

For real-time data, use WebSocket or SSE in a `useEffect` that writes to the atom.

---

### 6. State Persistence

**Status**: Not implemented  
**Questions to resolve**:

- Should visible/hidden layer state persist across page refreshes?
- Should the last selected basemap persist?
- Should the last viewport (center/zoom) persist?

**Recommended approach**:

- Use `jotai/utils` `atomWithStorage` for atoms that should persist:

```typescript
import { atomWithStorage } from 'jotai/utils';
// Replace basemapAtom with:
export const basemapAtom = atomWithStorage<BasemapId>('basemap', DEFAULT_BASEMAP);
```

---

### 7. Central Layer Control Panel (Option 3 Hybrid)

**Status**: Partially implemented (visibility flag exists; no full UI component)  
**What's needed**:

Create `components/map/LayerControlPanel.tsx`:

- Reads `layersAtom` to list all registered layers
- Shows a toggle switch per layer (using ShadCN `Switch`)
- Optionally shows layer-specific controls (opacity slider, color picker)
- Can be placed inside or outside `<BaseMap>` — works either way because it reads from global atom

---

### 8. Basemap Tiles Expansion

**Status**: 3 basemaps defined (Positron, Dark Matter, Voyager)  
**What's needed**:

Add to `lib/map/basetiles.ts`:

- Satellite imagery (via MapTiler, Stadia, or similar OSM-compatible provider)
- Topographic map style
- Minimalist/no-label variant

Note: All styles must be MapLibre GL Style Spec compliant (style.json URLs).

---

## Decisions Already Locked In

| Decision             | Choice                                                               |
| -------------------- | -------------------------------------------------------------------- |
| State management     | Jotai atoms (global, in `lib/atoms/map.ts`)                          |
| Map container sizing | C3: `width: 100%`, `height: 100%` — inherits parent                  |
| Layer registration   | Children return `null`, register via `useSmartLayer` to `layersAtom` |
| Layer visibility     | `visible` flag on each `LayerConfig` in `layersAtom`                 |
| Layer updates        | DeckGL `updateTriggers` for efficient diffing                        |
| Layer cleanup        | Automatic via `useEffect` return in `useSmartLayer`                  |
| Basemap switching    | External `BasemapSelector` reads/writes `basemapAtom`                |
| Default basemap      | Positron (CartoDB/OSM)                                               |
| Initial viewport     | Adelaide CBD: `[138.6007, -34.9285]`, zoom 12                        |
| Map controls         | Configurable prop: `{ pan, zoom, rotate, pitch }`                    |
| Location layer       | Reads `currentLocationAtom`, updates via `updateTriggers`            |
| Layer control UI     | Hybrid (Option 3): per-layer or central panel both supported         |

---

_Last updated: Implementation complete — revisit items are future work._
