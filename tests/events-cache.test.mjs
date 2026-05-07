import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCanonicalCacheKey, getTTLForQuery } from '../api/events.js';

test('buildCanonicalCacheKey is order-invariant for query params', () => {
  const a = { lat: 10.12345, lon: 20.54321, radius: 50, page: 2, page_size: 15, time_range: 'last_24h', category: 'crime', risk_level: 'all' };
  const b = { lon: 20.54321, radius: 50, lat: 10.12345, risk_level: 'all', category: 'crime', page_size: 15, page: 2, time_range: 'last_24h' };

  const ka = buildCanonicalCacheKey(a);
  const kb = buildCanonicalCacheKey(b);
  assert.equal(ka, kb, 'Cache keys should be identical regardless of param order');
});

test('getTTLForQuery returns expected TTLs', () => {
  assert.equal(getTTLForQuery('last_1h'), 300);
  assert.equal(getTTLForQuery('last_24h'), 300);
  assert.equal(getTTLForQuery('last_7d'), 1800);
  assert.equal(getTTLForQuery('all'), 3600);
});
