'use client';

import { useAtom } from 'jotai';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardAction } from '@/components/ui/card';
import { livePlanesSelectedAtom } from '@/lib/atoms/live-planes';

/** Formats a nullable number to a fixed number of decimal places, or returns '—'. */
function fmt(value: number | null | undefined, decimals = 1, unit = ''): string {
  if (value == null) return '—';
  return `${value.toFixed(decimals)}${unit ? ' ' + unit : ''}`;
}

interface RowProps {
  label: string;
  value: string;
  mono?: boolean;
}

function Row({ label, value, mono = false }: RowProps) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground uppercase tracking-wider shrink-0">{label}</span>
      <span className={`text-sm text-right ${mono ? 'font-mono' : 'font-medium'}`}>{value}</span>
    </div>
  );
}

/**
 * PlaneDetailsPanel
 *
 * Floating panel that appears when a plane is selected on the map.
 * Displays all fields from the Plane interface.
 * Dismisses when the × button is clicked (clears livePlanesSelectedAtom).
 */
export function PlaneDetailsPanel() {
  const [selected, setSelected] = useAtom(livePlanesSelectedAtom);

  if (!selected) return null;

  const heading = selected.trueTrack != null ? `${selected.trueTrack.toFixed(0)}°` : '—';

  return (
    <div className="absolute bottom-4 right-4 z-20 w-72">
      <Card className="bg-background/95 backdrop-blur-md shadow-2xl">
        <CardHeader className="border-b border-border/40">
          <CardTitle className="font-mono text-base">{selected.callsign ?? selected.icao24}</CardTitle>
          <CardAction>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setSelected(null)}
              aria-label="Close details"
            >
              <X size={14} />
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent className="pt-3 pb-1 space-y-0">
          <Row label="ICAO24" value={selected.icao24} mono />
          <Row label="Callsign" value={selected.callsign ?? '—'} mono />
          <Row label="Country" value={selected.originCountry} />
          <Row label="Longitude" value={fmt(selected.longitude, 4, '°')} mono />
          <Row label="Latitude" value={fmt(selected.latitude, 4, '°')} mono />
          <Row label="Altitude" value={fmt(selected.baroAltitude, 0, 'm')} mono />
          <Row label="Speed" value={fmt(selected.velocity, 1, 'm/s')} mono />
          <Row label="Heading" value={heading} mono />
          <Row label="Vertical rate" value={fmt(selected.verticalRate, 1, 'm/s')} mono />
          <Row label="On ground" value={selected.onGround ? 'Yes' : 'No'} />
        </CardContent>
      </Card>
    </div>
  );
}
