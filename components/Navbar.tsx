'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useHydrationAware } from '@/lib/hooks/useHydrationAware';
import { useTheme } from '@/app/providers';
import { Button } from '@/components/ui/button';
import { Moon, Sun } from 'lucide-react';

const NAV_LINKS = [
  { href: '/flights', label: 'Flights' },
  { href: '/planes', label: 'Planes' },
] as const;

function NavbarContent() {
  const { theme, toggleTheme } = useTheme();
  const isHydrated = useHydrationAware();
  const pathname = usePathname();

  return (
    <nav className="border-b border-border bg-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left side - Nav links */}
          <div className="flex items-center gap-1">
            {NAV_LINKS.map(({ href, label }) => {
              const active = pathname === href || pathname.startsWith(href + '/');
              return (
                <Link
                  key={href}
                  href={href}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </div>

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
