/**
 * Climate MVT API Proxy Route
 *
 * Proxies requests from the frontend (localhost:3000) to the backend API
 * (localhost:8000) to work around CORS restrictions during development.
 *
 * Routes:
 * - GET /api/climate-mvt/variables
 * - GET /api/climate-mvt/times/{variable}
 * - GET /api/climate-mvt/{variable}/{time}/z{zoom}.tif
 */

const BACKEND_API = 'http://localhost:8000';

/**
 * GET handler - proxies all requests to the backend API
 */
export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const pathParams = await params;
    const pathSegments = pathParams.path || [];
    const relativePath = pathSegments.join('/');

    // Extract query parameters from the request URL
    const url = new URL(request.url);
    const queryString = url.search; // Includes the ? if present

    // Construct the full backend URL with query parameters
    const backendUrl = `${BACKEND_API}/climate-mvt/${relativePath}${queryString}`;

    console.log(`[Climate MVT Proxy] GET ${backendUrl}`);

    // Fetch from the backend API
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        Accept: request.headers.get('Accept') || '*/*'
      }
    });

    if (!response.ok) {
      console.error(`[Climate MVT Proxy] Backend returned ${response.status} for ${backendUrl}`);
      return new Response('Backend API error', { status: response.status });
    }

    // For binary data (TIF files), return as-is with appropriate headers
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const buffer = await response.arrayBuffer();

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('[Climate MVT Proxy] Error:', error);
    return new Response('Proxy error', { status: 500 });
  }
}
