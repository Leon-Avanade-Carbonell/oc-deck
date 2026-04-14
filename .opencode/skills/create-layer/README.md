# create-layer Skill

A comprehensive guide for scaffolding production-ready DeckGL layer implementations in the oc-deck project.

## Overview

The `create-layer` skill provides detailed instructions for creating new map layers that:

- Follow the patterns defined in `components/map/agent-guides/DECKGL-GUIDE.md`
- Use DeckGL, MapLibre, React 19, TypeScript, and Jotai atoms
- Are immediately production-ready with proper typing, memoization, and state management
- Comply with the project's naming conventions and code quality standards

## Files in This Skill

- **SKILL.md** — Complete implementation guide with templates and code samples
- **README.md** — This file

## Quick Start

When using the `create-layer` skill (via OpenCode or directly), follow this flow:

### 1. Gather Requirements

Ask the user for:

- **Layer name** (unique across the project)
- **Interactivity needs** (does it support picking/selection?)
- **Dynamic data** (does it update based on zoom/bounds/API?)
- **Layer type** (recommended or user-selected)
- **Data source** (where the data comes from)
- **Toggle component** (create visibility toggle?)

### 2. Validate Uniqueness

Check for conflicts in:

- `components/map/layers/{kebabName}.tsx`
- `lib/atoms/{kebabName}.ts`
- `components/map/toggles/{kebabName}-toggle.tsx`

If conflicts exist, refuse and ask for a different name.

### 3. Select Template

Based on the answers:

| Interactivity | Dynamic Data | Template        | Use Case                                |
| ------------- | ------------ | --------------- | --------------------------------------- |
| NO            | NO           | C (Simple)      | Static markers, fixed overlays          |
| NO            | YES          | A (Data)        | Zoom-aware hexagons, API-driven data    |
| YES           | —            | B (Interactive) | Clickable hexagons, selectable features |

### 4. Generate Files

Create the three scaffolding files:

1. Layer component (`components/map/layers/{kebabName}.tsx`)
2. Atoms file (`lib/atoms/{kebabName}.ts`)
3. Toggle component (optional, `components/map/toggles/{kebabName}-toggle.tsx`)

All generated files should:

- ✅ Pass TypeScript strict mode
- ✅ Have no linting errors
- ✅ Include JSDoc comments
- ✅ Follow naming conventions
- ✅ Be immediately usable by the developer

### 5. Provide Integration Instructions

Output a summary showing:

- Files created (with relative paths)
- Next steps for customization
- Copy-paste code for BaseMap integration

## Example Output

```
📁 Files created:
  ✓ components/map/layers/sample-population.tsx
  ✓ lib/atoms/sample-population.ts
  ✓ components/map/toggles/sample-population-toggle.tsx

📋 Next Steps:

1. Customize the layer component:
   - Add your data fetching logic to populate samplePopulationDataAtom
   - Implement getFillColor, getLineColor for your data
   - Update updateTriggers with all dynamic properties

2. Add to BaseMap:
   import { SamplePopulationLayer } from '@/components/map/layers/sample-population';

   <BaseMap>
     <SamplePopulationLayer />
   </BaseMap>

3. Add toggle to UI (optional):
   import { SamplePopulationToggle } from '@/components/map/toggles/sample-population-toggle';

   <SamplePopulationToggle />

✨ Layer scaffolding complete!
```

## Testing

A sample layer (`sample-population`) has been generated as a test case:

- **Layer**: `components/map/layers/sample-population.tsx`
- **Atoms**: `lib/atoms/sample-population.ts`
- **Toggle**: `components/map/toggles/sample-population-toggle.tsx`

This layer demonstrates:

- ✅ Template A (Data Layer) implementation
- ✅ Zoom-aware data with debouncing
- ✅ Proper Jotai atom usage
- ✅ Memoized layer instance
- ✅ TypeScript strict mode compliance
- ✅ DeckGL guide checklist compliance
- ✅ All naming conventions followed

Verify linting passes:

```bash
bun run lint components/map/layers/sample-population.tsx \
  lib/atoms/sample-population.ts \
  components/map/toggles/sample-population-toggle.tsx
```

## Variables and Naming

When implementing, use these transformations:

```typescript
// Input: "HexPopulation"

// kebabName: for files and layer IDs
const kebabName = toKebabCase('HexPopulation'); // "hex-population"

// camelName: for atoms and functions
const camelName = toCamelCase('HexPopulation'); // "hexPopulation"

// PascalName: for React components
const PascalName = toPascalCase('HexPopulation'); // "HexPopulation"
```

## File Generation Rules

### Layer Component

**Location**: `components/map/layers/{kebabName}.tsx`

**Requirements**:

- Must have `'use client'` directive
- Must use `useSmartLayer()` hook
- Must memoize layer instance
- Must import atoms from `@/lib/atoms/{kebabName}`
- Must have JSDoc comment with purpose and data source
- Must return `null`

**By Template**:

- **Template C**: Minimal state, just visibility
- **Template A**: Includes zoom debouncing, updateTriggers
- **Template B**: Includes pickable=true, onClick, selection state

### Atoms File

**Location**: `lib/atoms/{kebabName}.ts`

**Requirements**:

- Must define `{camelName}DataAtom` (always)
- Must define `{camelName}VisibleAtom` (always)
- Must define `{camelName}SelectedAtom` (Template B only)
- Must have JSDoc comments
- Should use proper TypeScript interfaces when possible

### Toggle Component (Optional)

**Location**: `components/map/toggles/{kebabName}-toggle.tsx`

**Requirements**:

- Must have `'use client'` directive
- Must use Eye/EyeOff icons from `lucide-react`
- Must read/write `{camelName}VisibleAtom`
- Must use `Button` from `@/components/ui/button`
- Must have proper styling matching the theme

## References

- **DeckGL Guide**: `components/map/agent-guides/DECKGL-GUIDE.md`
- **DeckGL Gotchas**: `components/map/agent-guides/DECKGL-GOTCHA.md`
- **Existing Example**: `SampleHexLayer` in the codebase

## Integration Checklist

After generating a new layer, the developer should:

- [ ] Customize layer data fetching logic
- [ ] Implement color/styling functions
- [ ] Define proper TypeScript types
- [ ] Update `updateTriggers` for GPU efficiency
- [ ] Add layer to `BaseMap` component
- [ ] Add toggle to UI control panel (if created)
- [ ] Test layer visibility toggle
- [ ] Test layer with real data
- [ ] Run `bun run lint` to verify no type errors
- [ ] Run `bun run build` to ensure production build succeeds
