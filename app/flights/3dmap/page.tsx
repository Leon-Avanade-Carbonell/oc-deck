'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// Skip SSR — DeckGL requires WebGL which is only available in the browser.
const FlightsGlobeMap = dynamic(
  () => import('@/components/map/flights3d/FlightsGlobeMap').then((m) => m.FlightsGlobeMap),
  { ssr: false }
);

export default function Flights3DMapPage() {
  return (
    <Suspense fallback={null}>
      <FlightsGlobeMap />
    </Suspense>
  );
}
