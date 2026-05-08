import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import eventsHandler, { _clearEventsInMemoryCache } from '../api/events.js';

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

function restoreEnvironment() {
  globalThis.fetch = originalFetch;
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }
  for (const [key, value] of Object.entries(originalEnv)) {
    process.env[key] = value;
  }
  _clearEventsInMemoryCache();
}

function jsonResponse(payload, ok = true) {
  return {
    ok,
    async json() {
      return payload;
    },
  };
}

describe('GET /api/events backend behavior', () => {
  afterEach(() => {
    restoreEnvironment();
  });

  it('rejects invalid page_size values', async () => {
    const response = await eventsHandler(
      new Request('http://localhost/api/events?lat=21.0285&lon=105.8542&page_size=0')
    );

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.equal(payload.error, 'Invalid page_size: must be an integer between 1 and 100');
  });

  it('falls back to default sort for invalid sort values', async () => {
    const response = await eventsHandler(
      new Request(
        'http://localhost/api/events?lat=21.0285&lon=105.8542&radius=10000&sort=invalid_sort'
      )
    );

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.query.sort, 'occurred_at:desc');
    assert.ok(Array.isArray(payload.events));
    assert.ok(payload.events.length > 1);
    assert.ok(payload.events[0].timestamp >= payload.events[1].timestamp);
  });

  it('returns stable paginated results without overlap across pages', async () => {
    const page1 = await eventsHandler(
      new Request('http://localhost/api/events?lat=21.0285&lon=105.8542&radius=10000&page=1&page_size=2')
    );
    const page2 = await eventsHandler(
      new Request('http://localhost/api/events?lat=21.0285&lon=105.8542&radius=10000&page=2&page_size=2')
    );

    assert.equal(page1.status, 200);
    assert.equal(page2.status, 200);

    const payload1 = await page1.json();
    const payload2 = await page2.json();

    assert.equal(payload1.total, payload2.total);
    assert.ok(payload1.events.length <= 2);
    assert.ok(payload2.events.length <= 2);
    assert.ok(payload1.events.length > 0);
    assert.ok(payload2.events.length > 0);

    const idsPage1 = payload1.events.map((event) => event.id);
    const idsPage2 = payload2.events.map((event) => event.id);

    assert.equal(idsPage1.filter((id) => idsPage2.includes(id)).length, 0);
    assert.equal(payload1.page, 1);
    assert.equal(payload2.page, 2);
    assert.equal(payload1.page_size, 2);
    assert.equal(payload2.page_size, 2);
    assert.equal(typeof payload1.has_next, 'boolean');
    assert.equal(typeof payload2.has_next, 'boolean');
  });

  it('supports Redis read-through cache and returns X-Cache header', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.test';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token';

    const cacheStore = new Map();
    globalThis.fetch = async (url, init) => {
      const raw = String(url);
      if (raw.includes('/get/')) {
        const key = decodeURIComponent(raw.split('/get/')[1]);
        return jsonResponse({ result: cacheStore.has(key) ? JSON.stringify(cacheStore.get(key)) : undefined });
      }

      if (raw.includes('/set/')) {
        const path = raw.split('/set/')[1];
        const [encodedKey, rest] = path.split('/');
        const [encodedValue] = rest.split('/EX/');
        const key = decodeURIComponent(encodedKey);
        const value = JSON.parse(decodeURIComponent(encodedValue));
        cacheStore.set(key, value);
        return jsonResponse({ result: 'OK' });
      }

      throw new Error(`Unexpected fetch URL: ${raw}`);
    };

    const requestUrl =
      'http://localhost/api/events?lat=21.0285&lon=105.8542&radius=10000&page=1&page_size=1&sort=occurred_at:desc';

    const firstResponse = await eventsHandler(new Request(requestUrl));
    assert.equal(firstResponse.status, 200);
    assert.equal(firstResponse.headers.get('x-cache'), 'MISS');
    const firstPayload = await firstResponse.json();
    assert.equal(firstPayload.page, 1);

    const secondResponse = await eventsHandler(new Request(requestUrl));
    assert.equal(secondResponse.status, 200);
    assert.equal(secondResponse.headers.get('x-cache'), 'HIT');
    const secondPayload = await secondResponse.json();
    assert.deepEqual(secondPayload, firstPayload);
  });

  it('enforces event contract fields in each returned event object', async () => {
    const response = await eventsHandler(
      new Request('http://localhost/api/events?lat=21.0285&lon=105.8542&radius=10000&page=1&page_size=5')
    );
    assert.equal(response.status, 200);

    const payload = await response.json();
    assert.ok(Array.isArray(payload.events));
    for (const event of payload.events) {
      assert.equal(typeof event.id, 'string');
      assert.equal(typeof event.title, 'string');
      assert.equal(typeof event.location, 'object');
      assert.equal(typeof event.location.lat, 'number');
      assert.equal(typeof event.location.lon, 'number');
      assert.equal(typeof event.type, 'string');
      assert.equal(typeof event.severity, 'number');
      assert.equal(typeof event.timestamp, 'number');
      assert.equal(typeof event.risk_score, 'number');
      assert.equal(typeof event.source, 'string');
      assert.equal(typeof event.fallback_used, 'boolean');
      assert.equal(typeof event.threshold, 'string');
    }
  });
});
