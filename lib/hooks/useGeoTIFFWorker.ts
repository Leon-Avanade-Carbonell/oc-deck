'use client';

import { useEffect, useRef, useCallback } from 'react';

export interface GeoTIFFDecodeResult {
  bitmap: ImageBitmap;
  bounds: [number, number, number, number];
}

interface PendingRequest {
  resolve: (result: GeoTIFFDecodeResult) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

/**
 * Hook for decoding GeoTIFF files using a Web Worker
 * Manages worker lifecycle and request/response handling
 */
export function useGeoTIFFWorker() {
  const workerRef = useRef<Worker | null>(null);
  const pendingRequestsRef = useRef<Map<string, PendingRequest>>(new Map());
  const requestIdCounterRef = useRef(0);

  // Initialize worker on mount
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    console.log('[useGeoTIFFWorker] Initializing worker');

    try {
      // Create worker from the lib folder using relative import
      // Turbopack will bundle this and make it available as a worker
      workerRef.current = new Worker(new URL('../geotiff/decoder.worker.ts', import.meta.url), { type: 'module' });

      // Handle messages from the worker
      workerRef.current.onmessage = (event: MessageEvent) => {
        const { id, success, bitmap, bounds, error } = event.data;

        console.log('[useGeoTIFFWorker] Received response from worker:', id, 'success:', success);

        const pendingRequest = pendingRequestsRef.current.get(id);
        if (!pendingRequest) {
          console.warn('[useGeoTIFFWorker] Received response for unknown request:', id);
          return;
        }

        // Clear timeout
        clearTimeout(pendingRequest.timeout);
        pendingRequestsRef.current.delete(id);

        if (success && bitmap && bounds) {
          pendingRequest.resolve({ bitmap, bounds });
        } else {
          pendingRequest.reject(new Error(error || 'Unknown worker error'));
        }
      };

      // Handle worker errors
      workerRef.current.onerror = (event: ErrorEvent) => {
        console.error('[useGeoTIFFWorker] Worker error:', event.message);
        console.error('[useGeoTIFFWorker] Stack:', event.filename, ':', event.lineno);

        // Reject all pending requests
        pendingRequestsRef.current.forEach(({ reject, timeout }) => {
          clearTimeout(timeout);
          reject(new Error(`Worker error: ${event.message}`));
        });
        pendingRequestsRef.current.clear();
      };

      console.log('[useGeoTIFFWorker] Worker initialized successfully');
    } catch (error) {
      console.error('[useGeoTIFFWorker] Failed to initialize worker:', error);
    }

    // Cleanup on unmount
    return () => {
      console.log('[useGeoTIFFWorker] Cleaning up worker');
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }

      // Reject all pending requests
      pendingRequestsRef.current.forEach(({ reject, timeout }) => {
        clearTimeout(timeout);
        reject(new Error('Worker terminated'));
      });
      pendingRequestsRef.current.clear();
    };
  }, []);

  // Decode function that sends work to the worker
  const decode = useCallback(
    async (arrayBuffer: ArrayBuffer, bandMode: 'rgb' | 'raw' = 'rgb'): Promise<GeoTIFFDecodeResult> => {
      if (!workerRef.current) {
        throw new Error('GeoTIFF worker not initialized');
      }

      const id = `decode-${++requestIdCounterRef.current}`;
      console.log('[useGeoTIFFWorker] Starting decode request:', id);

      return new Promise((resolve, reject) => {
        // Set 30 second timeout
        const timeout = setTimeout(() => {
          pendingRequestsRef.current.delete(id);
          reject(new Error('GeoTIFF decode timeout (30s)'));
        }, 30000);

        // Store pending request
        pendingRequestsRef.current.set(id, { resolve, reject, timeout });

        // Send message to worker (transfer the arrayBuffer to avoid copying)
        try {
          workerRef.current!.postMessage(
            { id, arrayBuffer, bandMode },
            [arrayBuffer] // Transfer ownership of arrayBuffer
          );
        } catch (error) {
          clearTimeout(timeout);
          pendingRequestsRef.current.delete(id);
          reject(error);
        }
      });
    },
    []
  );

  return { decode };
}
