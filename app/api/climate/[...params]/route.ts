/**
 * API route: /api/climate/[...params]
 * 
 * Proxies requests to the Climate API backend.
 * This allows the browser to make requests without CORS issues.
 * 
 * Configuration:
 * - Set CLIMATE_API_BASE environment variable to change the backend URL
 * - Default: http://localhost:8000/climate
 * 
 * Examples:
 * - GET /api/climate/variables → http://localhost:8000/climate/variables
 * - GET /api/climate/times/monthly_rain → http://localhost:8000/climate/times/monthly_rain
 * - GET /api/climate/grid/monthly_rain/1989-01 → http://localhost:8000/climate/grid/monthly_rain/1989-01
 */

const CLIMATE_API_BASE = process.env.CLIMATE_API_BASE || 'http://localhost:8000/climate';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ params: string[] }> }
) {
  try {
    const { params: pathParams } = await params;
    const path = pathParams.join('/');
    
    // Extract query parameters from the request URL
    const url = new URL(request.url);
    const queryParams = url.searchParams.toString();
    
    // Construct the full URL to the backend API
    const backendUrl = `${CLIMATE_API_BASE}/${path}${queryParams ? `?${queryParams}` : ''}`;
    
    console.log(`[Climate API Proxy] ${request.method} ${backendUrl}`);
    
    // Forward the request to the backend
    const response = await fetch(backendUrl, {
      method: request.method,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Determine cache strategy based on endpoint
    let cacheControl = 'private, no-cache'; // Default: don't cache
    
    // Cache discovery endpoints (variables, times) for 1 hour
    if (path.includes('variables') || path.includes('times')) {
      cacheControl = 'public, max-age=3600';
    }
    // Don't cache grid data (it's requested on-demand with 150ms debounce)
    
    return Response.json(data, {
      status: 200,
      headers: {
        'Cache-Control': cacheControl,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Climate API Proxy] Error:', message);

    return Response.json(
      {
        error: 'Failed to fetch climate data',
        details: message,
      },
      { status: 500 }
    );
  }
}
