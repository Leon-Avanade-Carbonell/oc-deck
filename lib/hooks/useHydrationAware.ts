'use client';

import { useLayoutEffect, useState } from 'react';

/**
 * Hook that tracks whether the component has been hydrated on the client.
 * Returns false during server-side rendering and initial hydration,
 * then returns true after the client mounts.
 *
 * Use this to avoid hydration mismatches when state differs between server and client.
 *
 * Example:
 * ```
 * function MyComponent() {
 *   const isHydrated = useHydrationAware();
 *   if (!isHydrated) return null;
 *   return <div>{real content that depends on client state}</div>;
 * }
 * ```
 */
export function useHydrationAware(): boolean {
  const [isHydrated, setIsHydrated] = useState(false);

  useLayoutEffect(() => {
    // This is an intentional pattern to detect client-side hydration.
    // We must setState after the layout effect to avoid hydration mismatches.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsHydrated(true);
  }, []);

  return isHydrated;
}
