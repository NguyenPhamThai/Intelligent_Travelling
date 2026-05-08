/**
 * API Endpoint: GET /api/events
 * Returns risk events (weather, crime, riots, disaster) within a specified geographic radius.
 *
 * Query Parameters:
 *   - lat (required): Latitude of center point (-90 to 90)
 *   - lon (required): Longitude of center point (-180 to 180)
 *   - radius (optional, default: 50): Search radius in kilometers
 *   - page (optional, default: 1): Page number for pagination
 *   - page_size (optional, default: 20, max: 100): Items per page
 *   - sort (optional, default: occurred_at:desc): Sort order (occurred_at, risk_score)
 *
 * Response: {
 *   events: Event[],
 *   total: number,
 *   page: number,
 *   page_size: number,
 *   has_next: boolean,
 *   query: {...},
 *   timestamp: number
 * }
 *
 * Cache key is canonicalized by lat/lon, radius, page, page_size, sort, and query filters.
 */

import { getCorsHeaders } from './_cors.js';
import { jsonResponse } from './_json-response.js';
import { calculateRiskScore, getRiskLevel } from '../shared/risk-score.js';

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
    `sort:${params.sort || 'occurred_at:desc'}`,
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

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_RADIUS_KM = 10000;
const CACHE_TTL_SECONDS = 30;
const REDIS_READ_TIMEOUT_MS = 3000;
const REDIS_SET_TIMEOUT_MS = 3000;
const inMemoryCache = new Map();

const SORT_FIELD_MAP = {
  occurred_at: 'timestamp',
  risk_score: 'risk_score',
};

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
    Math.cos(toRad(lat1)) * Math.cos(toRad(lon1)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const earthRadiusKm = 6371;
  return earthRadiusKm * c;
}


function parseSortParam(rawSort) {
  const defaultSort = { field: 'timestamp', name: 'occurred_at', order: 'desc', descriptor: 'occurred_at:desc' };
  if (!rawSort || !rawSort.trim()) return defaultSort;

  let sortValue = rawSort.trim();
  let order = 'desc';
  if (sortValue.startsWith('-')) {
    order = 'desc';
    sortValue = sortValue.slice(1);
  } else if (sortValue.startsWith('+')) {
    order = 'asc';
    sortValue = sortValue.slice(1);
  }

  const parts = sortValue.split(':').map((part) => part.trim().toLowerCase()).filter(Boolean);
  const field = parts[0] ?? '';
  if (parts[1] === 'asc' || parts[1] === 'desc') {
    order = parts[1];
  }

  if (!Object.prototype.hasOwnProperty.call(SORT_FIELD_MAP, field)) {
    return defaultSort;
  }

  return {
    field: SORT_FIELD_MAP[field],
    name: field,
    order,
    descriptor: `${field}:${order}`,
  };
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

function enforceEventContract(event) {
  return {
    id: typeof event.id === 'string' ? event.id : '',
    title: typeof event.title === 'string' ? event.title : '',
    location: {
      lat: typeof event.location?.lat === 'number' ? event.location.lat : 0,
      lon: typeof event.location?.lon === 'number' ? event.location.lon : 0,
    },
    type: typeof event.type === 'string' ? event.type : 'unknown',
    severity: Number.isFinite(event.severity) ? event.severity : 0,
    timestamp: Number.isFinite(event.timestamp) ? event.timestamp : 0,
    risk_score: Number.isFinite(event.risk_score) ? event.risk_score : 0,
    source: typeof event.source === 'string' ? event.source : 'shared_scorer',
    fallback_used: typeof event.fallback_used === 'boolean' ? event.fallback_used : false,
    threshold: typeof event.threshold === 'string' ? event.threshold : 'unknown',
  };
}

function applySort(events, sort) {
  const direction = sort.order === 'asc' ? 1 : -1;
  return [...events].sort((a, b) => {
    const aValue = a[sort.field];
    const bValue = b[sort.field];

    if (aValue === bValue) {
      return a.id.localeCompare(b.id);
    }

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return (aValue - bValue) * direction;
    }

    return String(aValue).localeCompare(String(bValue)) * direction;
  });
}

function getEventsInRadius(lat, lon, radiusKm) {
  return MOCK_EVENTS.map((event) => ({
    event,
    distance: haversineDistance(lat, lon, event.location.lat, event.location.lon),
  }))
    .filter((entry) => entry.distance <= radiusKm)
    .map((entry) => {
      const riskScore = calculateRiskScore(entry.event);
      return enforceEventContract({
        ...entry.event,
        risk_score: riskScore,
        source: 'shared_scorer',
        fallback_used: false,
        threshold: getRiskLevel(riskScore),
      });
    });
}

async function readCache(cacheKey) {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!redisUrl || !redisToken) {
    return null;
  }

  try {
    const response = await fetch(`${redisUrl}/get/${encodeURIComponent(cacheKey)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${redisToken}` },
      signal: AbortSignal.timeout(REDIS_READ_TIMEOUT_MS),
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    if (!payload?.result) {
      return null;
    }

    return JSON.parse(payload.result);
  } catch {
    return null;
  }
}

async function writeCache(cacheKey, payload) {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!redisUrl || !redisToken) {
    return false;
  }

  try {
    const encoded = encodeURIComponent(JSON.stringify(payload));
    const response = await fetch(
      `${redisUrl}/set/${encodeURIComponent(cacheKey)}/${encoded}/EX/${CACHE_TTL_SECONDS}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${redisToken}` },
        signal: AbortSignal.timeout(REDIS_SET_TIMEOUT_MS),
      }
    );

    return response.ok;
  } catch {
    return false;
  }
}

export function _clearEventsInMemoryCache() {
  inMemoryCache.clear();
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
  const pageParam = url.searchParams.get('page');
  const pageSizeParam = url.searchParams.get('page_size');
  const sortParam = url.searchParams.get('sort');

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
    if (Number.isNaN(radiusNum) || radiusNum <= 0 || radiusNum > MAX_RADIUS_KM) {
      return jsonResponse(
        { error: 'Invalid radius: must be a number between 0 and 10000 km' },
        400,
        corsHeaders
      );
    }
    radiusKm = radiusNum;
  }

  const page = pageParam ? toNumber(pageParam) : DEFAULT_PAGE;
  const pageSize = pageSizeParam ? toNumber(pageSizeParam) : DEFAULT_PAGE_SIZE;

  if (Number.isNaN(page) || page < 1 || !Number.isInteger(page)) {
    return jsonResponse({ error: 'Invalid page: must be an integer >= 1' }, 400, corsHeaders);
  }

  if (Number.isNaN(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE || !Number.isInteger(pageSize)) {
    return jsonResponse(
      { error: `Invalid page_size: must be an integer between 1 and ${MAX_PAGE_SIZE}` },
      400,
      corsHeaders
    );
  }

  const sort = parseSortParam(sortParam);
  const cacheKey = buildCanonicalCacheKey({
    lat,
    lon,
    radius: radiusKm,
    page,
    page_size: pageSize,
    sort: sort.descriptor,
  });
  let serializedResponse = null;
  let cacheStatus = 'MISS';
  let redisAvailable = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

  if (redisAvailable) {
    serializedResponse = await readCache(cacheKey);
    if (serializedResponse) {
      cacheStatus = 'HIT';
    }
  }

  if (!serializedResponse && inMemoryCache.has(cacheKey)) {
    serializedResponse = inMemoryCache.get(cacheKey);
    cacheStatus = 'HIT';
    redisAvailable = false;
  }

  if (!serializedResponse) {
    const allEvents = getEventsInRadius(lat, lon, radiusKm);
    const sortedEvents = applySort(allEvents, sort);
    const total = sortedEvents.length;
    const startIndex = (page - 1) * pageSize;
    const pageItems = sortedEvents.slice(startIndex, startIndex + pageSize);

    serializedResponse = {
      events: pageItems,
      total,
      page,
      page_size: pageSize,
      has_next: startIndex + pageSize < total,
      query: { lat, lon, radius_km: radiusKm, sort: sort.descriptor },
      timestamp: Date.now(),
    };

    if (redisAvailable) {
      const writeSucceeded = await writeCache(cacheKey, serializedResponse);
      if (!writeSucceeded) {
        cacheStatus = 'BYPASS';
        inMemoryCache.set(cacheKey, serializedResponse);
      }
    } else {
      cacheStatus = cacheStatus === 'HIT' ? 'HIT' : 'BYPASS';
      inMemoryCache.set(cacheKey, serializedResponse);
    }
  }

  return jsonResponse(serializedResponse, 200, {
    ...corsHeaders,
    'X-Cache': cacheStatus,
  });
}
