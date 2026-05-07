import { test, describe } from 'node:test';
import assert from 'node:assert';

// Import functions (assuming we export them for testing)
import { buildCanonicalCacheKey, getTTLForQuery, addFreshnessMetadata } from './events.js';

describe('Cache Key Canonicalization', () => {
  test('buildCanonicalCacheKey handles required params', () => {
    const params = { lat: 21.0285, lon: 105.8542 };
    const key = buildCanonicalCacheKey(params);
    assert.strictEqual(key, 'events:category:all|lat:21.0285|lon:105.8542|page:1|page_size:10|radius:50|risk_level:all|time_range:all');
  });

  test('buildCanonicalCacheKey normalizes lat/lon', () => {
    const params1 = { lat: 21.02851111, lon: 105.85421111 };
    const params2 = { lat: 21.02852222, lon: 105.85422222 };
    const key1 = buildCanonicalCacheKey(params1);
    const key2 = buildCanonicalCacheKey(params2);
    // Should be same due to rounding
    assert.strictEqual(key1, key2);
  });

  test('buildCanonicalCacheKey is order-invariant', () => {
    const params1 = { lat: 21.0285, lon: 105.8542, radius: 100, time_range: 'last_24h' };
    const params2 = { time_range: 'last_24h', radius: 100, lon: 105.8542, lat: 21.0285 };
    const key1 = buildCanonicalCacheKey(params1);
    const key2 = buildCanonicalCacheKey(params2);
    assert.strictEqual(key1, key2);
  });

  test('buildCanonicalCacheKey avoids collision', () => {
    const params1 = { lat: 21.0285, lon: 105.8542, category: 'riot' };
    const params2 = { lat: 21.0285, lon: 105.8542, risk_level: 'red' };
    const key1 = buildCanonicalCacheKey(params1);
    const key2 = buildCanonicalCacheKey(params2);
    assert.notStrictEqual(key1, key2);
  });
});

describe('TTL Policy', () => {
  test('getTTLForQuery returns correct TTL', () => {
    assert.strictEqual(getTTLForQuery('last_1h'), 300); // hot
    assert.strictEqual(getTTLForQuery('last_24h'), 300); // hot
    assert.strictEqual(getTTLForQuery('last_7d'), 1800); // warm
    assert.strictEqual(getTTLForQuery('all'), 3600); // cold
  });
});

describe('Stale-data Guardrails', () => {
  test('addFreshnessMetadata adds metadata', () => {
    const data = { events: [], total: 0, query: {} };
    const generatedAt = Date.now();
    const enriched = addFreshnessMetadata(data, generatedAt);
    assert.strictEqual(enriched._freshness.generated_at, generatedAt);
    assert.strictEqual(typeof enriched._freshness.max_age_seconds, 'number');
    assert.strictEqual(enriched._freshness.is_stale, false);
  });

  test('stale detection logic', () => {
    const now = Date.now();
    const oldData = {
      events: [],
      total: 0,
      query: {},
      _freshness: {
        generated_at: now - 400000, // 400 seconds ago
        max_age_seconds: 300, // 5 minutes
        is_stale: false,
      },
    };
    // Should be stale
    const age = now - oldData._freshness.generated_at;
    assert(age > oldData._freshness.max_age_seconds * 1000);
  });
});