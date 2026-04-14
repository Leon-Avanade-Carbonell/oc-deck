---
name: create-layer
description: Scaffold complete DeckGL layer implementations interactively
license: MIT
compatibility: opencode
metadata:
  audience: developers
  workflow: map-development
---

# Create Layer Skill

Scaffold production-ready DeckGL layer implementations following the patterns in `components/map/agent-guides/DECKGL-GUIDE.md`.

## What I Do

I guide you through creating a new map layer by:

1. **Collecting layer details** — name, data type, interactivity level
2. **Decision tree analysis** — determining which template (simple, data, or interactive) fits best
3. **Generating complete scaffolding** including:
   - React component (`components/map/layers/{name}.tsx`)
   - Jotai atoms (`lib/atoms/{name}.ts`)
   - Optional visibility toggle (`components/map/toggles/{name}-toggle.tsx`)
4. **Providing integration instructions** — snippets showing where to add the layer to your `BaseMap`

## When to Use Me

Use this skill when you need to:

- Create a new map layer following DeckGL + MapLibre + Jotai conventions
- Scaffold boilerplate that follows all the patterns in `components/map/agent-guides/DECKGL-GUIDE.md`
- Generate layer components that are immediately production-ready
- Integrate layers into your `BaseMap` component

## Interactive Flow

When triggered, I ask:

1. **Layer name** — e.g., "HexPopulation", "TrafficFlows", "UserLocations"
2. **Interactivity question** — "Does your layer need interactive features (picking, selection, tooltips)?"
3. **Dynamic data question** (if not interactive) — "Does your layer render dynamic data (zoom-aware, API calls, filtered)?"
4. **Layer type recommendation** — Based on answers, I suggest the best DeckGL layer type
5. **Layer type confirmation** — Confirm or choose from common layer types
6. **Data source description** — How/where the layer gets its data
7. **Toggle component** — "Create a visibility toggle component?"

## Output

### Generated Files

- **Layer component** → `components/map/layers/{layerName}.tsx`
- **Atoms** → `lib/atoms/{layerName}.ts`
- **Toggle** (optional) → `components/map/toggles/{layerName}-toggle.tsx`

### Integration Summary

After generation, I provide:

- List of created files with paths
- Next steps and integration instructions
- Copy-paste-ready code snippet for adding the layer to `BaseMap`

## Key Features

### Template Selection

| Interactivity | Dynamic Data | Template        | Use Case                                |
| ------------- | ------------ | --------------- | --------------------------------------- |
| NO            | NO           | C (Simple)      | Static markers, fixed overlays          |
| NO            | YES          | A (Data)        | Zoom-aware hexagons, API-driven points  |
| YES           | —            | B (Interactive) | Clickable hexagons, selectable features |

### Code Quality

All generated code includes:

- ✅ TypeScript strict mode compatibility
- ✅ Jotai atoms for state management (no useState)
- ✅ useMemo for layer instance memoization
- ✅ updateTriggers configured for GPU efficiency
- ✅ JSDoc comments
- ✅ DeckGL guide compliance checklist

### Conflict Handling

If layer name already exists:

- Check for existing files (`{layerName}.tsx`, `{layerName}.ts`, `{layerName}-toggle.tsx`)
- Refuse to overwrite
- Prompt user for a different name
- Re-validate until unique

## Conventions

All scaffolded code follows these naming conventions:

- **Component file**: PascalCase (e.g., `MyLayer.tsx`)
- **Atoms file**: camelCase + "Atom" suffix (e.g., `myLayerDataAtom`)
- **Layer ID**: kebab-case (e.g., `id: 'my-layer'`)
- **Directories created automatically**:
  - `components/map/layers/` for layer components
  - `lib/atoms/` for atom definitions
  - `components/map/toggles/` for toggle components

## Reference

For detailed layer patterns, implementation examples, and troubleshooting, see:

- `components/map/agent-guides/DECKGL-GUIDE.md` — Complete layer guide with 3 templates
- `components/map/agent-guides/DECKGL-GOTCHA.md` — Common errors and fixes

## Implementation Steps

When implementing `/create-layer`, follow these steps:

### 1. Gather Layer Details

Ask interactively for:

- **Layer Name** (e.g., "HexPopulation") — validate: unique across `components/map/layers/`, `lib/atoms/`, and `components/map/toggles/`
- **Interactivity** — YES → Template B, NO → continue to Q3
- **Dynamic Data** (if not interactive) — YES → Template A, NO → Template C
- **Layer Type** — Recommend based on template, allow user to confirm or choose from common types
- **Data Source** — Brief description (e.g., "API endpoint", "hardcoded", "Jotai atom with external data")
- **Toggle Component** — YES/NO

### 2. Validate Unique Name

Before proceeding, check for existing files:

- `components/map/layers/{kebabName}.tsx`
- `lib/atoms/{kebabName}.ts`
- `components/map/toggles/{kebabName}-toggle.tsx`

If any exist, refuse and prompt for a different name.

### 3. Select Template

Based on interactivity + dynamic data:

**Template C — Simple Feature Layer** (NO interactivity, NO dynamic data)

- Minimal state (just visibility)
- Use ScatterplotLayer or simple layers
- No zoom debouncing

**Template A — Data Layer** (NO interactivity, YES dynamic data)

- State: dataAtom, visibleAtom
- Memoized layer instance
- Debounce zoom/pan events (150ms)
- updateTriggers configured

**Template B — Data + Interactivity Layer** (YES interactivity, any data)

- State: dataAtom, visibleAtom, selectedAtom
- Memoized layer instance
- pickable: true, onClick handler
- Color/width driven by selection state
- updateTriggers configured

### 4. Generate Files

Create three files (toggle is optional):

#### File 1: Layer Component

**Path**: `components/map/layers/{kebabName}.tsx`

Template structure:

```typescript
'use client';

import { useAtom } from 'jotai';
import { useMemo } from 'react';
import { [LayerType] } from '@deck.gl/layers';
import { useSmartLayer } from '@/lib/hooks/useSmartLayer';

import {
  {camelName}DataAtom,
  {camelName}VisibleAtom,
  // [{camelName}SelectedAtom] - if Template B
} from '@/lib/atoms/{kebabName}';

/**
 * {PascalName}Layer
 *
 * {Description of layer purpose}
 * Data source: {dataSource}
 */
export function {PascalName}Layer() {
  const [data] = useAtom({camelName}DataAtom);
  const [visible] = useAtom({camelName}VisibleAtom);
  // const [selected, setSelected] = useAtom({camelName}SelectedAtom); // if Template B

  const layer = useMemo(
    () =>
      new {LayerType}({
        id: '{kebabName}',
        data: visible ? data : [],
        // ... layer-specific props
        // updateTriggers: { ... }
      }),
    [data, visible] // [data, visible, selected, setSelected] for Template B
  );

  useSmartLayer(layer);

  return null;
}
```

#### File 2: Atoms

**Path**: `lib/atoms/{kebabName}.ts`

Template structure:

```typescript
import { atom } from 'jotai';

/**
 * {camelName}DataAtom
 * Stores the layer's data
 */
export const {camelName}DataAtom = atom<any[]>([]);

/**
 * {camelName}VisibleAtom
 * Controls layer visibility
 */
export const {camelName}VisibleAtom = atom(true);

// Only for Template B:
/**
 * {camelName}SelectedAtom
 * Stores the currently selected feature
 */
export const {camelName}SelectedAtom = atom<any | null>(null);
```

#### File 3: Toggle (Optional)

**Path**: `components/map/toggles/{kebabName}-toggle.tsx`

Template structure:

```typescript
'use client';

import { useAtom } from 'jotai';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';

import { {camelName}VisibleAtom } from '@/lib/atoms/{kebabName}';

/**
 * {PascalName}Toggle
 *
 * Button component to toggle layer visibility.
 */
export function {PascalName}Toggle() {
  const [visible, setVisible] = useAtom({camelName}VisibleAtom);

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
      aria-label="Toggle {kebabName} layer"
      title="Toggle {kebabName} layer"
    >
      {visible ? <Eye size={20} /> : <EyeOff size={20} />}
    </Button>
  );
}
```

### 5. Output Summary

After file generation, provide:

1. **Files Created** — List with relative paths
2. **Next Steps** — Specific instructions for the user
3. **Integration Snippet** — Copy-paste code for BaseMap integration

```
📁 Files created:
  ✓ components/map/layers/{kebabName}.tsx
  ✓ lib/atoms/{kebabName}.ts
  ✓ components/map/toggles/{kebabName}-toggle.tsx (if selected)

📋 Next Steps:

1. Customize the layer component:
   - Add your data fetching/API call logic
   - Implement getFillColor, getLineColor, and other style functions
   - Update updateTriggers to include all dynamic properties

2. Add to BaseMap:
   Edit app/{your-page}/page.tsx or components/map/BaseMap.tsx:

   import { {PascalName}Layer } from '@/components/map/layers/{kebabName}';

   <BaseMap>
     <{PascalName}Layer />
     {/* other layers */}
   </BaseMap>

3. Add toggle to UI (optional):
   Edit your control panel component:

   import { {PascalName}Toggle } from '@/components/map/toggles/{kebabName}-toggle';

   <{PascalName}Toggle />
```

## Variable Naming Conventions

- **kebabName**: `to-kebab-case(layerName)` — used for file names and layer IDs
- **camelName**: `toCamelCase(layerName)` — used for atoms (e.g., `myLayerDataAtom`)
- **PascalName**: `toPascalCase(layerName)` — used for React component names

## Code Quality Checklist

All generated code should satisfy:

- ✅ `'use client'` directive at top
- ✅ Jotai atoms imported and destructured with `useAtom`
- ✅ Layer instance created in `useMemo` with proper dependencies
- ✅ `useSmartLayer(layer)` called after instance creation
- ✅ Component returns `null` (renders via DeckGL canvas)
- ✅ JSDoc comments on component and atoms
- ✅ All dynamic properties in `updateTriggers`
- ✅ Placeholder color functions and styling for user to customize
- ✅ TypeScript strict mode compatible (proper typing)
- ✅ No `useState` — only Jotai atoms
- ✅ For Template B: `pickable: true` and `onClick` handler set

## Common Recommendations

When recommending layer types:

- **H3 hexagons** → PolygonLayer
- **GeoJSON features** → GeoJsonLayer
- **Points/markers** → ScatterplotLayer
- **Lines/routes** → LineLayer
- **Heatmaps** → HeatmapLayer
- **Icons** → IconLayer

## Files Generated Checklist

After generation, verify:

- [ ] All files created at correct paths
- [ ] Layer component imports from correct atoms file
- [ ] Toggle component (if created) imports from correct atoms file
- [ ] Files follow naming conventions (kebab-case for files, camelCase for atoms, PascalCase for components)
- [ ] No TypeScript errors on generated code
- [ ] Layer component is properly memoized
- [ ] Atoms file exports all needed atoms
- [ ] Toggle uses Eye/EyeOff icons from lucide-react
