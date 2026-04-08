'use client';

import { useHydrationAware } from '@/lib/hooks/useHydrationAware';
import { useTheme } from '@/app/providers';
import { Button } from '@/components/ui/button';
import { Moon, Sun } from 'lucide-react';

function NavbarContent() {
  const { theme, toggleTheme } = useTheme();
  const isHydrated = useHydrationAware();

  return (
    <nav className="border-b border-border bg-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left side - Logo/Brand (empty for now, to be designed later) */}
          <div className="flex-1" />

          {/* Right side - Theme toggle */}
          {isHydrated ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </Button>
          ) : (
            <div className="h-10 w-10" />
          )}
        </div>
      </div>
    </nav>
  );
}

export function Navbar() {
  return <NavbarContent />;
}
