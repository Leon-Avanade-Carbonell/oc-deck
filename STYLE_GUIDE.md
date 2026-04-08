# Style Guide

This document provides comprehensive guidance on component usage, styling conventions, and theming for this project.

## ShadCN Component Library

### Priority Rule

**Always use ShadCN components** (`@/components/ui/*`) for all UI elements. Do not create custom styled components or use raw HTML elements (except for semantic structure).

### Adding New Components

When you need a new component:

1. Check if it exists in `components/ui/` (run `bun x shadcn add <component-name>`)
2. If not available, install it: `bun x shadcn@latest add <component-name>`
3. Import and use: `import { ComponentName } from '@/components/ui/component-name'`
4. Customize styling using Tailwind classes and CSS variables

### Commonly Used Components

- **Button**: `@/components/ui/button` - All clickable actions
- **Card**: `@/components/ui/card` - Containers with styling
- **Input**: `@/components/ui/input` - Form inputs
- **Label**: `@/components/ui/label` - Form labels
- **Dialog**: `@/components/ui/dialog` - Modal dialogs
- **Sheet**: `@/components/ui/sheet` - Sliding panels
- **Tabs**: `@/components/ui/tabs` - Tabbed content

## Theming

### Color Palette

The project uses a warm gray newspaper-inspired palette:

**Light Mode (Print-like):**

- Background: `#faf8f3` (off-white, like aged paper)
- Foreground: `#2a2a2a` (dark charcoal for text)
- Accent: `#4a4a4a` (medium gray)
- Muted: `#d4d0c8` (warm gray for borders)

**Dark Mode (Evening Newspaper):**

- Background: `#1a1815` (deep charcoal with warm undertone)
- Foreground: `#f5f3f0` (off-white, easy on eyes)
- Accent: `#a89d95` (warm light gray)
- Muted: `#4a4540` (warm dark gray)

These colors are defined in `app/theme.css` as CSS variables that power all components.

### Using Colors in Components

Use semantic CSS variable names instead of hardcoding colors:

```tsx
// ✅ Correct - uses theme variables
<div className="bg-background text-foreground border border-border">
  <span className="text-muted-foreground">Secondary text</span>
</div>

// ❌ Incorrect - hardcoded colors
<div className="bg-white text-black border border-gray-200">
  <span className="text-gray-500">Secondary text</span>
</div>
```

### Available CSS Variables

All ShadCN color variables are available:

- `--background`, `--foreground`
- `--primary`, `--primary-foreground`
- `--secondary`, `--secondary-foreground`
- `--accent`, `--accent-foreground`
- `--muted`, `--muted-foreground`
- `--border`, `--input`
- `--ring`, `--destructive`
- `--card`, `--card-foreground`
- `--popover`, `--popover-foreground`

## Dark Mode Support

### Theme Switching

Use the `useTheme()` hook to access and toggle the theme:

```tsx
'use client';

import { useTheme } from '@/app/providers';
import { Button } from '@/components/ui/button';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
      {theme === 'light' ? <Moon /> : <Sun />}
    </Button>
  );
}
```

### How It Works

1. Theme preference is stored in `localStorage` and persists across sessions
2. Falls back to system preference (`prefers-color-scheme`) if no saved preference
3. Theme is applied via `data-theme` attribute and `.dark` class on the HTML element
4. ShadCN components automatically adapt colors via CSS variables

## Icons

### Using Lucide Icons

Always use Lucide icons (`lucide-react`):

```tsx
import { ChevronDown, Menu, X } from 'lucide-react';

export function Navigation() {
  return (
    <nav className="flex gap-2">
      <button>
        <Menu className="w-5 h-5" />
      </button>
      <button>
        <X className="w-5 h-5" />
      </button>
      <ChevronDown className="w-4 h-4" />
    </nav>
  );
}
```

Icons inherit color from their parent element via the `text-{color}` class.

## Layout Conventions

### Component Structure

```tsx
'use client'; // If using hooks

import { ComponentName } from '@/components/ui/component-name';

export function MyComponent() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Heading</h1>
      <p className="text-muted-foreground">Description</p>
    </div>
  );
}
```

### Spacing

Use Tailwind's spacing scale with semantic naming:

- `space-x-*`, `space-y-*` - Gaps between elements
- `p-*` (padding), `m-*` (margin) - Direct spacing
- Prefer `gap` over margins in flex/grid containers

### Responsive Design

Use Tailwind's responsive prefixes:

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{/* Content */}</div>
```

## Component Customization

### Extending Components

When a ShadCN component needs customization:

1. **CSS Classes**: Use Tailwind classes for styling
2. **Theme Variables**: Use CSS variables for colors
3. **Create Variants**: Use className patterns or compound components

```tsx
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CustomButtonProps extends React.ComponentPropsWithoutRef<typeof Button> {
  isLoading?: boolean;
}

export function LoadingButton({ isLoading, ...props }: CustomButtonProps) {
  return (
    <Button disabled={isLoading} {...props}>
      {isLoading ? 'Loading...' : props.children}
    </Button>
  );
}
```

## Best Practices

### Do's

- ✅ Use ShadCN components for everything
- ✅ Use semantic color variables (`bg-background`, `text-foreground`)
- ✅ Test components in both light and dark modes
- ✅ Use `cn()` utility for conditional classes
- ✅ Mark client components with `'use client'`

### Don'ts

- ❌ Create custom styled components instead of using ShadCN
- ❌ Use hardcoded color values
- ❌ Use Bootstrap or other UI frameworks
- ❌ Ignore the theme system
- ❌ Create new CSS files for component styling

## Maintenance

### Updating the Theme

To adjust colors, edit `app/theme.css`:

- Update color values in `:root` (light mode)
- Update color values in `[data-theme="dark"]` (dark mode)
- Update `.dark` class as fallback for Tailwind compatibility

All ShadCN components will automatically use the new colors.

### Adding Components

When adding a new ShadCN component:

```bash
bun x shadcn@latest add component-name
```

The component will automatically inherit your theme colors.
