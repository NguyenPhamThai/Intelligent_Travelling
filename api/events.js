/**
 * API Endpoint: GET /api/events
 * (with cache key canonicalization + stale-data guardrails)
 *
 * Returns risk events (weather, crime, riots, etc.) within a specified geographic radius.
 *
 * Query Parameters:
 *   - lat (required): Latitude of center point (-90 to 90)
 *   - lon (required): Longitude of center point (-180 to 180)
 *   - radius (optional, default: 50): Search radius in kilometers
 *
 * Response: { events: Event[], total: number, query: {...}, timestamp: number, _freshness: {...} }
 *
 * Cache Key: Canonical, order-invariant, normalized lat/lon to 4 decimals
 * TTL Policy: hot(5m) for <24h, warm(30m) for 7d, cold(1h) for all
 * Stale Guard: freshness metadata + stale-while-revalidate policy
 *
 * Example:
 *   GET /api/events?lat=25.7617&lon=-80.1918&radius=100
 */

import { getCorsHeaders } from './_cors.js';
import { jsonResponse } from './_json-response.js';
import { calculateRiskScore, getRiskLevel } from '../shared/risk-score.js';
import { readJsonFromUpstash, writeJsonToUpstash } from './_upstash-json.js';

// Cache key canonicalization
export function buildCanonicalCacheKey(params) {
  // Required params: lat, lon (rounded to 4 decimal places for ~11m precision)
  const lat = Math.round(params.lat * 10000) / 10000;
  const lon = Math.round(params.lon * 10000) / 10000;

  // Optional params with defaults
  const radius = params.radius || 50;
  const page = params.page || 1;
  const page_size = params.page_size || 10;
  const time_range = params.time_range || 'all';
  const category = params.category || 'all';
  const risk_level = params.risk_level || 'all';

  // Sort params alphabetically to ensure order-invariant
  const keyParts = [
    `lat:${lat}`,
    `lon:${lon}`,
    `radius:${radius}`,
    `page:${page}`,
    `page_size:${page_size}`,
    `time_range:${time_range}`,
    `category:${category}`,
    `risk_level:${risk_level}`,
  ].sort();

  // Namespace with version to allow safe invalidation/rolling upgrades
  return `events:v1:${keyParts.join('|')}`;
}

// Build Redis SCAN-friendly patterns for targeted invalidation.
// Returns an array of glob patterns that can be supplied to `api/cache-purge.js`.
export function buildCachePurgePatterns({ lat, lon, radius, time_range, category, risk_level } = {}) {
  const parts = [];
  if (lat !== undefined) parts.push(`lat:${Math.round(lat * 10000) / 10000}`);
  if (lon !== undefined) parts.push(`lon:${Math.round(lon * 10000) / 10000}`);
  if (radius !== undefined) parts.push(`radius:${radius}`);
  if (time_range !== undefined) parts.push(`time_range:${time_range}`);
  if (category !== undefined) parts.push(`category:${category}`);
  if (risk_level !== undefined) parts.push(`risk_level:${risk_level}`);

  // Because keys are 'events:v1:' + sorted('|') joined parts, we match any key containing all parts in any order
  // by using wildcard before/after each part and combining into a single pattern.
  if (parts.length === 0) return [`events:v1:*`];
  const compound = parts.map(p => `*${p}*`).join('');
  return [`events:v1:${compound}`];
}

// TTL policy matrix
const TTL_MATRIX = {
  hot: 300,    // 5 minutes for recent events (< 24h)
  warm: 1800,  // 30 minutes for medium-term
  cold: 3600,  // 1 hour for historical
};

// Determine TTL based on time_range
export function getTTLForQuery(time_range) {
  switch (time_range) {
    case 'last_1h':
    case 'last_24h':
      return TTL_MATRIX.hot;
    case 'last_7d':
      return TTL_MATRIX.warm;
    default:
      return TTL_MATRIX.cold;
  }
}

// Stale-data guardrails
export function addFreshnessMetadata(data, generatedAt) {
  const maxAgeSeconds = getTTLForQuery(data.query?.time_range || 'all');
  return {
    ...data,
    _freshness: {
      generated_at: generatedAt,
      max_age_seconds: maxAgeSeconds,
      is_stale: false, // Will be set by cache layer
    },
  };
}

const MOCK_EVENTS = [
  // RED (score > 70): High severity
  {
    id: 'evt-001-hanoi-riot',
    title: 'Hanoi Riot Alert',
    location: { lat: 21.0285, lon: 105.8542 },
    type: 'riot',
    severity: 0.8,
    timestamp: Date.now(),
  },
  // YELLOW (30-70): Medium severity
  {
    id: 'evt-002-hcmc-crime',
    title: 'HCMC Crime Surge',
    location: { lat: 10.8231, lon: 106.6297 },
    type: 'crime',
    severity: 0.6,
    timestamp: Date.now() - 600000,
  },
  // YELLOW (30-70): Medium severity weather
  {
    id: 'evt-003-da-nang-weather',
    title: 'Da Nang Weather Alert',
    location: { lat: 16.0544, lon: 108.2022 },
    type: 'weather',
    severity: 0.8,
    timestamp: Date.now() - 1200000,
  },
  // GREEN (< 30): Low severity
  {
    id: 'evt-004-hue-riot',
    title: 'Hue Protest',
    location: { lat: 16.4637, lon: 107.5909 },
    type: 'riot',
    severity: 0.2,
    timestamp: Date.now() - 3600000,
  },
  // RED (score > 70): High severity
  {
    id: 'evt-005-nha-trang-crime',
    title: 'Nha Trang Incident',
    location: { lat: 12.2388, lon: 109.1967 },
    type: 'crime',
    severity: 0.95,
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
    .map((entry) => {
      const riskScore = calculateRiskScore(entry.event);
      return {
        ...entry.event,
        risk_score: riskScore,
        source: 'shared_scorer',
        fallback_used: false,
        threshold: getRiskLevel(riskScore),
      };
    })
    .sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0));
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

export default async function handler(request) {
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

  // Parse additional query params that affect results
  const pageParam = url.searchParams.get('page');
  const pageSizeParam = url.searchParams.get('page_size') || url.searchParams.get('pageSize');
  const timeRangeParam = url.searchParams.get('time_range') || url.searchParams.get('timeRange');
  const categoryParam = url.searchParams.get('category');
  const riskLevelParam = url.searchParams.get('risk_level') || url.searchParams.get('riskLevel');

  const page = Number.isFinite(Number(pageParam)) ? Number(pageParam) : 1;
  const page_size = Number.isFinite(Number(pageSizeParam)) ? Number(pageSizeParam) : 10;
  const time_range = timeRangeParam || 'all';
  const category = categoryParam || 'all';
  const risk_level = riskLevelParam || 'all';

  const params = { lat, lon, radius: radiusKm, page, page_size, time_range, category, risk_level };
  const cacheKey = buildCanonicalCacheKey(params);
  const ttl = getTTLForQuery(params.time_range || 'all');

  // Check cache
  try {
    const cached = await readJsonFromUpstash(cacheKey);
    if (cached && cached._freshness) {
      const age = Date.now() - cached._freshness.generated_at;
      if (age < cached._freshness.max_age_seconds * 1000) {
        // Fresh
        return jsonResponse(cached, 200, corsHeaders);
      } else {
        // Stale - return with stale flag (stale-while-revalidate)
        cached._freshness.is_stale = true;
        return jsonResponse(cached, 200, corsHeaders);
      }
    }
  } catch (error) {
    console.warn('Cache read failed:', error.message);
  }

  // Compute fresh data
  const events = getEventsInRadius(lat, lon, radiusKm);
  const responseData = {
    events,
    total: events.length,
    query: { lat, lon, radius_km: radiusKm, page, page_size, time_range, category, risk_level },
    timestamp: Date.now(),
  };

  const freshData = addFreshnessMetadata(responseData, Date.now());

  // Cache the fresh data: write to Upstash (non-blocking)
  try {
    // write main cache entry with TTL
    writeJsonToUpstash(cacheKey, freshData, ttl).catch((err) => console.warn('Cache write failed:', err.message));
    // write seed-meta for freshness tracking (longer TTL)
    const seedMetaKey = `seed-meta:${cacheKey}`;
    const seedMeta = { fetchedAt: Date.now(), recordCount: events.length };
    writeJsonToUpstash(seedMetaKey, seedMeta, Math.max(60, ttl * 2)).catch((err) => console.warn('Seed-meta write failed:', err.message));
  } catch (err) {
    console.warn('Cache pipeline error:', err.message);
  }

  return jsonResponse(freshData, 200, corsHeaders);
}
