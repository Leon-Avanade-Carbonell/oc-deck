/**
 * OpenSky Network API Proxy Route
 *
 * Proxies requests to the OpenSky Network REST API to work around CORS
 * restrictions — browsers are blocked from calling opensky-network.org directly.
 *
 * Routes:
 * - GET /api/opensky/states/all  → https://opensky-network.org/api/states/all
 */

const OPENSKY_BASE = 'https://opensky-network.org/api';

/**
 * GET handler — proxies to https://opensky-network.org/api/states/all.
 */
export async function GET() {
  const upstreamUrl = `${OPENSKY_BASE}/states/all`;
  try {
    console.log(`[OpenSky Proxy] GET ${upstreamUrl}`);

    const response = await fetch(upstreamUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      // Next.js: don't cache — data changes every few seconds
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error(`[OpenSky Proxy] Upstream returned ${response.status}`);
      return new Response('OpenSky API error', { status: response.status });
    }

    const data = await response.text();

    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        // No caching — the layer controls its own poll interval
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[OpenSky Proxy] Error:', error);
    return new Response('Proxy error', { status: 500 });
  }
}
