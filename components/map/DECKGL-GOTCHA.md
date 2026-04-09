# DeckGL + MapLibre Gotchas

Agent reference for known errors when building map pages with DeckGL and MapLibre GL via `react-map-gl`.

---

## Quick Reference

| Symptom                                                                     | Root Cause                                                                | Fix                                               |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------- |
| `TypeError: Cannot read properties of undefined (reading '_loaded')`        | `maplibre-gl` v5.x incompatible with `@vis.gl/react-maplibre`             | Pin `maplibre-gl` to `^4.x`                       |
| Map container renders but map canvas is blank / JS error about browser APIs | `'use client'` does not skip SSR — MapLibre GL crashes on the server      | Use `dynamic(..., { ssr: false })` for `BaseMap`  |
| Map container renders, no error, but map is invisible                       | `h-full` resolves to 0px when parent has `min-height` instead of `height` | Use `h-screen` + `min-h-0` on the map page layout |

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
