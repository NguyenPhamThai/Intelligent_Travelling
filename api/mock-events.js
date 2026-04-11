import { getCorsHeaders } from './_cors.js';
import { jsonResponse } from './_json-response.js';

export const config = { runtime: 'edge' };

export default async function handler(request) {
  const corsHeaders = getCorsHeaders(request, 'GET, OPTIONS');

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);
  }

  try {
    const mockUrl = new URL('/mocks/events.json', request.url).toString();
    const upstream = await fetch(mockUrl, { headers: { Accept: 'application/json' } });

    if (!upstream.ok) {
      return jsonResponse({ error: 'Mock events file unavailable' }, 502, corsHeaders);
    }

    const data = await upstream.text();
    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  } catch (error) {
    return jsonResponse(
      { error: 'Failed to load mock events', details: error instanceof Error ? error.message : String(error) },
      500,
      corsHeaders,
    );
  }
}
