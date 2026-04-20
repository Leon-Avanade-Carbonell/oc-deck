'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapIcon } from 'lucide-react';
import type { FlightRequest } from '@/lib/atoms/flights';

function formatDateTime(req: FlightRequest): string {
  const h = String(req.hour).padStart(2, '0');
  const m = String(req.minute).padStart(2, '0');
  return `${req.date} ${h}:${m} UTC`;
}

export default function FlightsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<FlightRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      let res: Response;
      try {
        res = await fetch('/api/flights/requests');
      } catch (err) {
        setError(String(err));
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        setLoading(false);
        return;
      }

      const data = (await res.json()) as FlightRequest[];
      setRequests(data);
      setLoading(false);
    };

    void load();
  }, []);

  const openMap = (id: string) => {
    router.push(`/flights/map?requestId=${id}`);
  };

  return (
    <main className="flex-1 min-h-0 overflow-auto">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Flight Sessions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Select an ingestion session to view its animated trajectory map.
          </p>
        </div>

        {loading && (
          <p className="text-sm text-muted-foreground animate-pulse">Loading sessions…</p>
        )}

        {error && (
          <p className="text-sm text-destructive">Failed to load sessions: {error}</p>
        )}

        {!loading && !error && requests.length === 0 && (
          <p className="text-sm text-muted-foreground">No sessions found.</p>
        )}

        {!loading && !error && requests.length > 0 && (
          <div className="border border-border">
            {/* Header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-2 bg-muted text-xs font-medium text-muted-foreground uppercase tracking-wider border-b border-border">
              <span>Date / Time (UTC)</span>
              <span className="text-right">Snapshots</span>
              <span className="text-right">Ingested</span>
              <span />
            </div>

            {/* Rows */}
            {requests.map((req) => (
              <div
                key={req.id}
                className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-4 py-3 border-b border-border last:border-b-0 hover:bg-accent/50 transition-colors cursor-pointer group"
                onClick={() => openMap(req.id)}
              >
                <div>
                  <span className="text-sm font-medium">{formatDateTime(req)}</span>
                  <span className="ml-2 font-mono text-xs text-muted-foreground">{req.id.slice(0, 8)}…</span>
                </div>
                <span className="text-sm tabular-nums text-right">{req.time_ts_count}</span>
                <span className="text-xs text-muted-foreground text-right">
                  {new Date(req.created_at).toLocaleString()}
                </span>
                <button
                  className="flex items-center gap-1.5 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => { e.stopPropagation(); openMap(req.id); }}
                  aria-label="Open map"
                >
                  <MapIcon className="h-3.5 w-3.5" />
                  Map
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
