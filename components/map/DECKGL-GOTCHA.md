# DeckGL + MapLibre Gotchas

Agent reference for known errors when building map pages with DeckGL and MapLibre GL via `react-map-gl`.

---

## Quick Reference

| Symptom                                                                     | Root Cause                                                                | Fix                                                |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------- |
| `TypeError: Cannot read properties of undefined (reading '_loaded')`        | `maplibre-gl` v5.x incompatible with `@vis.gl/react-maplibre`             | Pin `maplibre-gl` to `^4.x`                        |
| Map container renders but map canvas is blank / JS error about browser APIs | `'use client'` does not skip SSR — MapLibre GL crashes on the server      | Use `dynamic(..., { ssr: false })` for `BaseMap`   |
| Map container renders, no error, but map is invisible                       | `h-full` resolves to 0px when parent has `min-height` instead of `height` | Use `h-screen` + `min-h-0` on the map page layout  |
| WebGL error `getUniformBlockIndex` on layer visibility toggle               | Layer filtering destroys WebGL state during hide/show cycles              | Keep layer in array, render empty data when hidden |

---

## Gotcha 1 — MapLibre GL v5 is incompatible with `react-map-gl`

### Symptom

```
TypeError: Cannot read properties of undefined (reading '_loaded')
```

The error is thrown inside the `<Map>` component on first render.

### Root Cause

`@vis.gl/react-maplibre` (used internally by `react-map-gl/maplibre`) reads the private property `map.style._loaded` to check if the map style has finished loading. This private property was removed in MapLibre GL v5, causing an immediate crash.

The package declares `"maplibre-gl": ">=4.0.0"` as a peer dependency but does not guard against v5 breaking changes.

### Fix

Pin `maplibre-gl` to the latest v4 release:

```bash
bun add maplibre-gl@4.7.1
# or
npm install maplibre-gl@4.7.1
```

> **Tested with**: `maplibre-gl@5.22.0` (broken) → `maplibre-gl@4.7.1` (working), `@vis.gl/react-maplibre@8.1.0`, `react-map-gl@8.1.0`
>
> **General rule**: Use `maplibre-gl` v4.x until `react-map-gl` explicitly declares v5 support.

### Rule

> Always pin `maplibre-gl` to `^4.x`. Do not install the `latest` tag — it resolves to v5 which silently breaks `react-map-gl`.

---

## Gotcha 2 — MapLibre GL crashes during SSR even with `'use client'`

### Symptom

Map container renders in the HTML shell but the map canvas is blank, or a JS error about browser APIs (`window`, `WebGL`, `ResizeObserver`, `devicePixelRatio`) is thrown on page load.

### Root Cause

In Next.js App Router, `'use client'` does **not** skip server-side rendering. Client components are still pre-rendered on the server to generate the initial HTML shell. MapLibre GL requires browser APIs that do not exist on the server, so it crashes or silently fails during this pre-render phase.

**Broken pattern** — `'use client'` is not enough:

```tsx
// page.tsx
'use client';

import { BaseMap } from '@/components/map/BaseMap'; // ❌ still SSR'd

export default function MapPage() {
  return <BaseMap />;
}
```

### Fix

Use `next/dynamic` with `ssr: false` inside a Client Component to completely skip server-side rendering for the map:

```tsx
// page.tsx
'use client'; // required — ssr: false only works inside a Client Component

import dynamic from 'next/dynamic';

const BaseMap = dynamic(
  () => import('@/components/map/BaseMap').then((m) => m.BaseMap),
  { ssr: false } // ✅ skips server pre-render entirely
);

export default function MapPage() {
  return <BaseMap />;
}
```

> **Note**: `ssr: false` must be used inside a `'use client'` component. Placing it in a Server Component will throw an error.

### Rule

> Any component that imports `maplibre-gl` (directly or transitively) must be loaded with `dynamic(..., { ssr: false })`. `'use client'` alone is not sufficient.

---

## Gotcha 3 — Map is invisible with no errors (height collapse)

### Symptom

The map page renders without errors, the `<Map>` component mounts, but the map canvas is invisible — nothing is visible where the map should be. Inspecting the DOM shows the map container has `height: 0`.

### Root Cause

CSS `height: 100%` on a child only works when the parent has an explicit `height` property. A parent with only `min-height` does **not** establish a containing block for percentage heights. The `h-full` Tailwind class (`height: 100%`) silently collapses to `0px` when its parent uses `min-h-full` (`min-height: 100%`).

Additionally, flex children have a default `min-height: auto` which prevents them from being constrained to their available space — the map overflows instead of being contained.

**Broken pattern**:

```tsx
// ❌ h-full collapses — body has min-height, not height
<div className="flex flex-col h-full">
  <Navbar />
  <main className="relative flex-1">
    {' '}
    {/* flex-1 can't expand — parent is 0px */}
    <BaseMap /> {/* height: 100% of 0px = 0px */}
  </main>
</div>
```

### Fix

Use `h-screen` to establish a definite viewport height that doesn't depend on the parent. Add `min-h-0` to flex children that contain overflowing content:

```tsx
// ✅ h-screen gives a definite height independent of parent
<div className="flex flex-col h-screen overflow-hidden">
  <Navbar />
  {/* min-h-0 overrides flex default min-height: auto */}
  <main className="relative flex-1 min-h-0">
    <BaseMap /> {/* now fills the available flex space correctly */}
  </main>
</div>
```

### Rule

> Never use `h-full` on a map page wrapper. Use `h-screen` (or `h-dvh` for mobile viewport correctness). Always add `min-h-0` to any `flex-1` element that contains a map or other full-height canvas component.

---

## Gotcha 4 — WebGL errors when toggling layer visibility

### Symptom

```
TypeError: Failed to execute 'getUniformBlockIndex' on 'WebGL2RenderingContext': parameter 1 is not of type 'WebGLProgram'.
```

This error occurs when toggling a smart layer's visibility off and then on again, especially after the layer's data has changed while it was invisible.

### Root Cause

DeckGL layers manage WebGL resources (shaders, buffers, uniforms) that are tied to the layer instance. When a layer is filtered out of the layers array (removed from rendering), DeckGL destroys its WebGL resources. If the layer is then re-added with a new instance (which happens when data changes via `useMemo`), DeckGL attempts to initialize new WebGL state for the new instance.

However, timing issues can cause DeckGL to reference destroyed WebGL resources from the old layer instance, resulting in `getUniformBlockIndex` being called with an invalid `WebGLProgram`.

**Broken pattern** — Filtering layers by visibility:

```tsx
// BaseMap.tsx - filters out invisible layers
const visibleLayers = layers.filter((l) => l.visible).map((l) => l.layer);
// When layer.visible becomes false, the layer is removed from the array
// DeckGL destroys its WebGL resources
// When layer.visible becomes true again, a new layer instance is added
// But if data changed while invisible, WebGL state can be corrupted
```

### Fix

Keep the layer always in the layers array, but render empty data when it should be invisible:

```tsx
// SampleHexLayer.tsx
const layer = useMemo(() => {
  // Render empty data when invisible — layer stays in array, WebGL state preserved
  const dataToRender = layerVisible ? hexData : [];

  return new PolygonLayer({
    id: LAYER_ID,
    data: dataToRender,
    getPolygon: (d) => d.geometry,
    // ... other props
    updateTriggers: {
      getFillColor: dataToRender,
      getPolygon: dataToRender
    }
  });
}, [hexData, layerVisible]);

// Register layer WITHOUT filtering by visibility
const { setVisible } = useSmartLayer({
  id: LAYER_ID,
  layer,
  label: 'Hex Sample'
});

// Always set visible to true (layer never leaves array)
useEffect(() => {
  setVisible(true);
}, [setVisible]);
```

**Key points**:

- Layer is always in the layers array passed to DeckGL
- WebGL resources are never destroyed/recreated
- Visual visibility is controlled by passing empty data (`data: []`)
- The layer is logically "hidden" (nothing rendered) but never removed from DeckGL's view

### Related Gotchas

This also relates to **Gotcha 5** (layer data mutation) — avoid mutating `layer.props` directly:

```tsx
// ❌ WRONG — props are read-only
layerRef.current.props.data = newData;

// ✅ RIGHT — recreate the layer via useMemo
const layer = useMemo(
  () =>
    new PolygonLayer({
      ...oldLayer.props,
      data: newData
    }),
  [newData]
);
```

### Rule

> **Never filter layers out of the array for visibility control.** Keep all layers in the array and control visibility by passing empty data. This prevents WebGL resource destruction/recreation cycles that cause state corruption.

---

## Gotcha 5 — Cannot mutate DeckGL layer props

### Symptom

```
TypeError: Cannot assign to read-only property 'data' of object
```

Attempting to update layer properties directly after the layer instance is created.

### Root Cause

DeckGL layer props are read-only once the layer instance is created. DeckGL tracks property changes via object references and identity, not mutation. Attempting to mutate `layer.props.data` directly does not trigger DeckGL's update machinery.

### Fix

Create a new layer instance with updated props using `useMemo`. Always include all changing properties in the dependency array:

```tsx
// ❌ WRONG
useEffect(() => {
  if (layerRef.current) {
    layerRef.current.props.data = hexData; // read-only error
  }
}, [hexData]);

// ✅ RIGHT
const layer = useMemo(() => {
  return new PolygonLayer({
    id: LAYER_ID,
    data: hexData,
    updateTriggers: {
      getFillColor: hexData
    }
  });
}, [hexData]); // include all changing data in dependency array
```

### Rule

> DeckGL layer props are immutable. Always recreate the layer instance via `useMemo` when data changes. Include all changing values in the dependency array so the layer instance is regenerated when they change.
