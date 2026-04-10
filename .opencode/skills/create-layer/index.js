#!/usr/bin/env node

/**
 * create-layer skill implementation
 * 
 * This script scaffolds complete DeckGL layer implementations following
 * the patterns defined in components/map/agent-guides/DECKGL-GUIDE.md
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

interface LayerConfig {
  name: string;
  layerType: string;
  template: 'A' | 'B' | 'C';
  hasInteractivity: boolean;
  hasDynamicData: boolean;
  dataSource: string;
  hasToggle: boolean;
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      resolve(answer.trim());
    });
  });
}

function toCamelCase(str: string): string {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
      index === 0 ? word.toLowerCase() : word.toUpperCase()
    )
    .replace(/\s+/g, '');
}

function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

function toPascalCase(str: string): string {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w|-)/g, (word) => word.toUpperCase())
    .replace(/[\s_-]+/g, '');
}

function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

async function validateLayerName(name: string, projectRoot: string): Promise<boolean> {
  const camelName = toCamelCase(name);
  const kebabName = toKebabCase(name);
  
  const layerPath = path.join(projectRoot, 'components/map/layers', `${kebabName}.tsx`);
  const atomsPath = path.join(projectRoot, 'lib/atoms', `${camelName}.ts`);
  const togglePath = path.join(projectRoot, 'components/map/toggles', `${kebabName}-toggle.tsx`);
  
  const conflicts = [
    fileExists(layerPath) ? `components/map/layers/${kebabName}.tsx` : null,
    fileExists(atomsPath) ? `lib/atoms/${camelName}.ts` : null,
    fileExists(togglePath) ? `components/map/toggles/${kebabName}-toggle.tsx` : null,
  ].filter(Boolean);
  
  return conflicts.length === 0;
}

function generateLayerComponent(config: LayerConfig): string {
  const camelName = toCamelCase(config.name);
  const kebabName = toKebabCase(config.name);
  const atomsImports = `${camelName}DataAtom, ${camelName}VisibleAtom${config.template === 'B' ? `, ${camelName}SelectedAtom` : ''}`;
  
  if (config.template === 'C') {
    return `'use client';

import { useAtom } from 'jotai';
import { useMemo } from 'react';
import { ScatterplotLayer } from '@deck.gl/layers';
import { useSmartLayer } from '@/lib/hooks/useSmartLayer';

import { ${atomsImports} } from '@/lib/atoms/${kebabName}';

/**
 * ${config.name} Layer
 * 
 * A simple static layer for displaying ${config.dataSource}.
 * No dynamic data updates or interactivity.
 */
export function ${toPascalCase(config.name)}Layer() {
  const [visible] = useAtom(${camelName}VisibleAtom);

  const layer = useMemo(
    () =>
      new ScatterplotLayer({
        id: '${kebabName}',
        data: visible ? [] : [], // Add your data here
        getPosition: (d: any) => d.position,
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
`;
  }
  
  if (config.template === 'A') {
    return `'use client';

import { useAtom } from 'jotai';
import { useMemo, useRef, useEffect } from 'react';
import { PolygonLayer } from '@deck.gl/layers';
import { useSmartLayer } from '@/lib/hooks/useSmartLayer';

import { ${atomsImports} } from '@/lib/atoms/${kebabName}';
import { mapZoomAtom } from '@/lib/atoms/map';

/**
 * ${config.name} Layer
 * 
 * A dynamic data layer that updates based on zoom level and map bounds.
 * Data source: ${config.dataSource}
 */
export function ${toPascalCase(config.name)}Layer() {
  const [data] = useAtom(${camelName}DataAtom);
  const [visible] = useAtom(${camelName}VisibleAtom);
  const [zoom] = useAtom(mapZoomAtom);
  const debounceTimerRef = useRef<NodeJS.Timeout>();

  // Debounce data regeneration on zoom changes (150ms)
  useEffect(() => {
    clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      // Trigger data regeneration based on zoom
      // (handled by separate hook that listens to mapZoomAtom)
    }, 150);
    return () => clearTimeout(debounceTimerRef.current);
  }, [zoom]);

  const layer = useMemo(
    () =>
      new PolygonLayer({
        id: '${kebabName}',
        data: visible ? data : [],
        stroked: true,
        filled: true,
        getLineColor: [0, 0, 0],
        getFillColor: (feature: any) => {
          // TODO: Implement your color mapping logic here
          return [200, 150, 100];
        },
        getLineWidth: 1,
        updateTriggers: {
          getFillColor: [data],
        },
      }),
    [data, visible]
  );

  useSmartLayer(layer);

  return null;
}
`;
  }
  
  // Template B: Interactive
  return `'use client';

import { useAtom } from 'jotai';
import { useMemo } from 'react';
import { PolygonLayer } from '@deck.gl/layers';
import { useSmartLayer } from '@/lib/hooks/useSmartLayer';
import { useDeckGLOverlay } from '@/lib/hooks/useDeckGLOverlay';

import { ${atomsImports} } from '@/lib/atoms/${kebabName}';

/**
 * ${config.name} Layer
 * 
 * An interactive layer with picking, selection, and click detection.
 * Data source: ${config.dataSource}
 */
export function ${toPascalCase(config.name)}Layer() {
  const [data] = useAtom(${camelName}DataAtom);
  const [visible] = useAtom(${camelName}VisibleAtom);
  const [selected, setSelected] = useAtom(${camelName}SelectedAtom);
  const overlay = useDeckGLOverlay();

  const layer = useMemo(
    () =>
      new PolygonLayer({
        id: '${kebabName}',
        data: visible ? data : [],
        stroked: true,
        filled: true,
        getLineColor: [0, 0, 0],
        getFillColor: (feature: any) =>
          selected && feature.id === selected.id
            ? [255, 140, 0] // Highlight on selection
            : [200, 150, 100],
        getLineWidth: (feature: any) =>
          selected && feature.id === selected.id ? 3 : 1,
        pickable: true,
        onClick: (info: any) => {
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
`;
}

function generateAtomsFile(config: LayerConfig): string {
  const camelName = toCamelCase(config.name);
  const kebabName = toKebabCase(config.name);
  
  const atoms = [];
  
  atoms.push(`/**
 * ${camelName}DataAtom
 * Stores the layer's data (features, geometries, etc.)
 */
export const ${camelName}DataAtom = atom<any[]>([]);`);
  
  atoms.push(`
/**
 * ${camelName}VisibleAtom
 * Controls layer visibility
 */
export const ${camelName}VisibleAtom = atom(true);`);
  
  if (config.template === 'B') {
    atoms.push(`
/**
 * ${camelName}SelectedAtom
 * Stores the currently selected feature (interactive layers only)
 */
export const ${camelName}SelectedAtom = atom<any | null>(null);`);
  }
  
  return `import { atom } from 'jotai';

${atoms.join('\n')}
`;
}

function generateToggleComponent(config: LayerConfig): string {
  const camelName = toCamelCase(config.name);
  const kebabName = toKebabCase(config.name);
  const pascalName = toPascalCase(config.name);
  
  return `'use client';

import { useAtom } from 'jotai';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';

import { ${camelName}VisibleAtom } from '@/lib/atoms/${kebabName}';

/**
 * ${pascalName}Toggle
 * 
 * Button component to toggle ${kebabName} layer visibility.
 */
export function ${pascalName}Toggle() {
  const [visible, setVisible] = useAtom(${camelName}VisibleAtom);

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setVisible(!visible)}
      className={\`transition-colors backdrop-blur-sm \${
        visible
          ? 'bg-orange-500 border-orange-500 text-white'
          : 'bg-background/90'
      }\`}
      aria-label="Toggle ${kebabName} layer"
      title="Toggle ${kebabName} layer"
    >
      {visible ? <Eye size={20} /> : <EyeOff size={20} />}
    </Button>
  );
}
`;
}

async function main() {
  console.log('\n🎨 DeckGL Layer Scaffolder\n');
  
  const projectRoot = process.cwd();
  
  // Step 1: Get layer name
  console.log('Step 1/7: Layer Name');
  let layerName = '';
  while (!layerName) {
    layerName = await question('  Enter layer name (e.g., HexPopulation, TrafficFlows): > ');
    
    if (!layerName.match(/^[a-zA-Z][a-zA-Z0-9]*$/)) {
      console.log('  ❌ Invalid name. Must start with a letter and contain only letters/numbers.');
      layerName = '';
      continue;
    }
    
    const isUnique = await validateLayerName(layerName, projectRoot);
    if (!isUnique) {
      console.log(`  ❌ Layer name "${layerName}" already exists. Try a different name.`);
      layerName = '';
    }
  }
  
  // Step 2: Interactivity
  console.log('\nStep 2/7: Interactivity');
  let hasInteractivity = false;
  let answer = await question('  Does your layer need interactive features (picking, selection, tooltips)? (yes/no): > ');
  hasInteractivity = answer.toLowerCase().startsWith('y');
  
  let hasDynamicData = false;
  let template: 'A' | 'B' | 'C' = 'C';
  
  if (hasInteractivity) {
    template = 'B';
    console.log('  ✓ Using Template B (Data + Interactivity)');
  } else {
    // Step 3: Dynamic data
    console.log('\nStep 3/7: Dynamic Data');
    answer = await question('  Does your layer render dynamic data (zoom, bounds, API calls)? (yes/no): > ');
    hasDynamicData = answer.toLowerCase().startsWith('y');
    template = hasDynamicData ? 'A' : 'C';
    console.log(`  ✓ Using Template ${template} (${template === 'A' ? 'Data Layer' : 'Simple Feature'})`);
  }
  
  // Step 4: Layer type
  console.log('\nStep 4/7: Layer Type');
  const recommendedType = hasDynamicData || hasInteractivity ? 'PolygonLayer' : 'ScatterplotLayer';
  console.log(`  Recommended: ${recommendedType}`);
  answer = await question(`  Use ${recommendedType}? (yes/no): > `);
  const layerType = answer.toLowerCase().startsWith('y') ? recommendedType : 'PolygonLayer';
  
  // Step 5: Data source
  console.log('\nStep 5/7: Data Source');
  const dataSource = await question('  Where does your data come from? (e.g., API, hardcoded, Jotai atom): > ');
  
  // Step 6: Toggle component
  console.log('\nStep 6/7: Toggle Component');
  answer = await question('  Create a visibility toggle component? (yes/no): > ');
  const hasToggle = answer.toLowerCase().startsWith('y');
  
  const config: LayerConfig = {
    name: layerName,
    layerType,
    template,
    hasInteractivity,
    hasDynamicData,
    dataSource,
    hasToggle,
  };
  
  // Step 7: Generate files
  console.log('\nStep 7/7: Generating Files...\n');
  
  const camelName = toCamelCase(config.name);
  const kebabName = toKebabCase(config.name);
  const pascalName = toPascalCase(config.name);
  
  const layerDir = path.join(projectRoot, 'components/map/layers');
  const atomsDir = path.join(projectRoot, 'lib/atoms');
  const togglesDir = path.join(projectRoot, 'components/map/toggles');
  
  // Create directories
  fs.mkdirSync(layerDir, { recursive: true });
  fs.mkdirSync(atomsDir, { recursive: true });
  if (hasToggle) {
    fs.mkdirSync(togglesDir, { recursive: true });
  }
  
  // Generate files
  const layerPath = path.join(layerDir, `${kebabName}.tsx`);
  const atomsPath = path.join(atomsDir, `${kebabName}.ts`);
  const togglePath = hasToggle ? path.join(togglesDir, `${kebabName}-toggle.tsx`) : null;
  
  fs.writeFileSync(layerPath, generateLayerComponent(config));
  fs.writeFileSync(atomsPath, generateAtomsFile(config));
  if (togglePath) {
    fs.writeFileSync(togglePath, generateToggleComponent(config));
  }
  
  // Output summary
  console.log('📁 Files created:\n');
  console.log(`  ✓ components/map/layers/${kebabName}.tsx`);
  console.log(`  ✓ lib/atoms/${kebabName}.ts`);
  if (hasToggle) {
    console.log(`  ✓ components/map/toggles/${kebabName}-toggle.tsx`);
  }
  
  console.log('\n📋 Next Steps:\n');
  console.log(`  1. Customize the layer component:`);
  console.log(`     - Add your API call or data fetching logic`);
  console.log(`     - Implement getFillColor and other styling functions`);
  console.log(`     - Update data to use your actual source`);
  console.log(`\n  2. Add the layer to BaseMap:`);
  console.log(`     - Import: import { ${pascalName}Layer } from '@/components/map/layers/${kebabName}';`);
  console.log(`     - Add child: <${pascalName}Layer />`);
  if (hasToggle) {
    console.log(`\n  3. Add toggle to UI panel:`);
    console.log(`     - Import: import { ${pascalName}Toggle } from '@/components/map/toggles/${kebabName}-toggle';`);
    console.log(`     - Add button: <${pascalName}Toggle />`);
  }
  
  console.log('\n💡 Integration Snippet:\n');
  console.log(`In your BaseMap or map page component:\n`);
  console.log(`  <BaseMap>`);
  console.log(`    <${pascalName}Layer />`);
  console.log(`    {/* other layers */}`);
  console.log(`  </BaseMap>\n`);
  if (hasToggle) {
    console.log(`In your UI control panel:\n`);
    console.log(`  <${pascalName}Toggle />\n`);
  }
  
  console.log('✨ Layer scaffolding complete!\n');
  
  rl.close();
}

main().catch((err) => {
  console.error('Error:', err);
  rl.close();
  process.exit(1);
});
