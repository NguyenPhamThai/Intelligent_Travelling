/**
 * API Endpoint: GET /api/events
 * (fixed implementation)
 * 
 * Returns risk events (weather, crime, riots, etc.) within a specified geographic radius.
 * 
 * Query Parameters:
 *   - lat (required): Latitude of center point (-90 to 90)
 *   - lon (required): Longitude of center point (-180 to 180)
 *   - radius (optional, default: 50): Search radius in kilometers
 * 
 * Response: { events: Event[], total: number, query: {...}, timestamp: number }
 * 
 * Example:
 *   GET /api/events?lat=25.7617&lon=-80.1918&radius=100
 */

import { getCorsHeaders } from './_cors.js';
import { jsonResponse } from './_json-response.js';

// Calculate risk_score from severity: severity * 20
function calculateRiskScore(severity) {
  return typeof severity === 'number' ? severity * 20 : null;
}

const MOCK_EVENTS = [
  {
    id: 'evt-001-hanoi-riot',
    title: 'Hanoi Riot Alert',
    location: { lat: 21.0285, lon: 105.8542 },
    type: 'riot',
    severity: 8,
    timestamp: Date.now(),
  },
  {
    id: 'evt-002-hcmc-crime',
    title: 'HCMC Crime Surge',
    location: { lat: 10.8231, lon: 106.6297 },
    type: 'crime',
    severity: 6,
    timestamp: Date.now() - 600000,
  },
  {
    id: 'evt-003-da-nang-weather',
    title: 'Da Nang Weather Alert',
    location: { lat: 16.0544, lon: 108.2022 },
    type: 'weather',
    severity: 7,
    timestamp: Date.now() - 1200000,
  },
  {
    id: 'evt-004-hue-riot',
    title: 'Hue Protest',
    location: { lat: 16.4637, lon: 107.5909 },
    type: 'riot',
    severity: 5,
    timestamp: Date.now() - 3600000,
  },
  {
    id: 'evt-005-nha-trang-crime',
    title: 'Nha Trang Incident',
    location: { lat: 12.2388, lon: 109.1967 },
    type: 'crime',
    severity: 4,
    timestamp: Date.now() - 7200000,
  },
];

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const earthRadiusKm = 6371;
  return earthRadiusKm * c;
}

function getEventsInRadius(lat, lon, radiusKm) {
  return MOCK_EVENTS.map((event) => ({
    event,
    distance: haversineDistance(lat, lon, event.location.lat, event.location.lon),
  }))
    .filter((entry) => entry.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance)
    .map((entry) => ({
      ...entry.event,
      risk_score: calculateRiskScore(entry.event.severity),
    }));
}

function validateCoordinates(lat, lon) {
  const latNum = toNumber(lat);
  const lonNum = toNumber(lon);

  if (Number.isNaN(latNum) || Number.isNaN(lonNum)) {
    return { valid: false, error: 'Invalid lat/lon: must be numbers' };
  }
  if (latNum < -90 || latNum > 90) {
    return { valid: false, error: 'Latitude must be between -90 and 90' };
  }
  if (lonNum < -180 || lonNum > 180) {
    return { valid: false, error: 'Longitude must be between -180 and 180' };
  }

  return { valid: true };
}

export const config = { runtime: 'edge' };

export default function handler(request) {
  const corsHeaders = getCorsHeaders(request, 'GET, OPTIONS');

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed. Use GET.' }, 405, corsHeaders);
  }

  const url = new URL(request.url);
  const latParam = url.searchParams.get('lat');
  const lonParam = url.searchParams.get('lon');
  const radiusParam = url.searchParams.get('radius');

  if (!latParam || !lonParam) {
    return jsonResponse({ error: 'Missing required parameters: lat and lon' }, 400, corsHeaders);
  }

  const validation = validateCoordinates(latParam, lonParam);
  if (!validation.valid) {
    return jsonResponse({ error: validation.error }, 400, corsHeaders);
  }

  const lat = toNumber(latParam);
  const lon = toNumber(lonParam);
  let radiusKm = 50;

  if (radiusParam && radiusParam.trim() !== '') {
    const radiusNum = toNumber(radiusParam);
    if (Number.isNaN(radiusNum) || radiusNum <= 0 || radiusNum > 10000) {
      return jsonResponse(
        { error: 'Invalid radius: must be a number between 0 and 10000 km' },
        400,
        corsHeaders
      );
    }
    radiusKm = radiusNum;
  }

  const events = getEventsInRadius(lat, lon, radiusKm);

  return jsonResponse(
    {
      events,
      total: events.length,
      query: { lat, lon, radius_km: radiusKm },
      timestamp: Date.now(),
    },
    200,
    corsHeaders
  );
}
