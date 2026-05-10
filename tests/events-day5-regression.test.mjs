import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import eventsHandler from '../api/events.js';

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

afterEach(() => {
  globalThis.fetch = originalFetch;
  Object.keys(process.env).forEach((key) => {
    if (!(key in originalEnv)) delete process.env[key];
  });
  Object.assign(process.env, originalEnv);
});

describe('Day 5 /events regression suite', () => {
  it('returns pagination metadata and respects sort whitelist fallback', async () => {
    const response = await eventsHandler(
      new Request('http://localhost/api/events?lat=21.0285&lon=105.8542&radius=10000&page=1&page_size=10&sort=bad_field')
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('X-Cache'), 'MISS');

    const payload = await response.json();
    assert.equal(typeof payload.total, 'number');
    assert.equal(typeof payload.has_next, 'boolean');
    assert.equal(payload.page, 1);
    assert.equal(payload.page_size, 10);
    assert.equal(payload.query.sort, 'risk_score:desc');
    assert.ok(Array.isArray(payload.events));

    for (let i = 1; i < payload.events.length; i++) {
      assert.ok(payload.events[i - 1].risk_score >= payload.events[i].risk_score, 'fallback sort must be risk_score desc');
    }
  });

  it('normalizes invalid page_size and keeps deterministic non-overlap across pages', async () => {
    const page1Res = await eventsHandler(
      new Request('http://localhost/api/events?lat=21.0285&lon=105.8542&radius=10000&page=1&page_size=2&sort=occurred_at:desc')
    );
    const page2Res = await eventsHandler(
      new Request('http://localhost/api/events?lat=21.0285&lon=105.8542&radius=10000&page=2&page_size=2&sort=occurred_at:desc')
    );
    const pageBadSizeRes = await eventsHandler(
      new Request('http://localhost/api/events?lat=21.0285&lon=105.8542&radius=10000&page=1&page_size=10000')
    );

    const p1 = await page1Res.json();
    const p2 = await page2Res.json();
    const pBad = await pageBadSizeRes.json();

    assert.equal(pBad.page_size, 100, 'page_size must be bounded to MAX_PAGE_SIZE');

    const page1Ids = new Set(p1.events.map((event) => event.id));
    const page2Ids = new Set(p2.events.map((event) => event.id));
    const overlap = [...page1Ids].filter((id) => page2Ids.has(id));
    assert.equal(overlap.length, 0, 'same filter+sort with different pages must not overlap');
  });

  it('returns explicit no-data payload for empty result set', async () => {
    const response = await eventsHandler(
      new Request('http://localhost/api/events?lat=0&lon=0&radius=1&page=1&page_size=10')
    );
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.ok(Array.isArray(payload.events));
    assert.equal(payload.events.length, 0);
    assert.equal(payload.total, 0);
    assert.equal(payload.has_next, false);
  });

  it('falls back to in-memory cache and marks cache as BYPASS when Redis is unavailable', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://upstash.example';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token';
    globalThis.fetch = async () => {
      throw new Error('redis unavailable');
    };

    const first = await eventsHandler(
      new Request('http://localhost/api/events?lat=21.0285&lon=105.8542&radius=10000&page=1&page_size=2')
    );
    const second = await eventsHandler(
      new Request('http://localhost/api/events?lat=21.0285&lon=105.8542&radius=10000&page=1&page_size=2')
    );

    assert.equal(first.headers.get('X-Cache'), 'BYPASS');
    assert.equal(second.headers.get('X-Cache'), 'BYPASS');

    const firstPayload = await first.json();
    const secondPayload = await second.json();
    assert.deepEqual(secondPayload.events, firstPayload.events);
  });
});
