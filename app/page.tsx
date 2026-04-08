'use client';

import { Navbar } from '@/components/Navbar';

export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <div className="flex flex-col h-full">
      <Navbar />
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Welcome</h1>
          <p className="text-muted-foreground mb-8">
            This project uses ShadCN components with a warm newspaper-inspired gray theme.
          </p>
          <p className="text-sm text-muted-foreground">
            Use the theme toggle in the navbar to switch between light and dark modes.
          </p>
        </div>
      </main>
    </div>
  );
}
