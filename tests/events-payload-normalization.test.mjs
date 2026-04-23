import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fetchNewsEvents, fetchWeatherEvents } from '../src/services/safety/data-pipeline.ts';
import { MOCK_EVENTS } from '../src/mocks/mockEvents.ts';

const originalFetch = globalThis.fetch;

function assertRequiredEventFields(event) {
  assert.equal(typeof event.type, 'string');
  assert.equal(typeof event.severity, 'number');
  assert.ok(Number.isFinite(event.severity));
  assert.equal(typeof event.timestamp, 'number');
  assert.ok(Number.isFinite(event.timestamp));
  assert.equal(typeof event.location, 'object');
  assert.ok(Number.isFinite(event.location?.lat));
  assert.ok(Number.isFinite(event.location?.lon));
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('event payload normalization', () => {
  it('weather fetcher returns canonical Event shape without hardcoded risk_score', async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          weather: [{ id: 501 }],
          coord: { lat: 21.0285, lon: 105.8542 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );

    const events = await fetchWeatherEvents();
    assert.ok(events.length > 0);

    for (const event of events) {
      assertRequiredEventFields(event);
      assert.equal(Object.prototype.hasOwnProperty.call(event, 'risk_score'), false);
      assert.ok(['weather', 'crime', 'riot'].includes(event.type));
    }
  });

  it('news fetcher returns canonical Event shape without hardcoded risk_score', async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          articles: [{ title: 'Riot escalates in city center' }, { title: 'Major weather disruption expected' }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );

    const events = await fetchNewsEvents();
    assert.ok(events.length > 0);

    for (const event of events) {
      assertRequiredEventFields(event);
      assert.equal(Object.prototype.hasOwnProperty.call(event, 'risk_score'), false);
      assert.ok(['weather', 'crime', 'riot'].includes(event.type));
    }
  });

  it('static mock payloads do not hardcode risk_score', () => {
    for (const event of MOCK_EVENTS) {
      assertRequiredEventFields(event);
      assert.equal(Object.prototype.hasOwnProperty.call(event, 'risk_score'), false);
    }

    const rawPublicMock = readFileSync('public/mocks/events.json', 'utf8');
    const publicEvents = JSON.parse(rawPublicMock);
    assert.ok(Array.isArray(publicEvents));
    for (const event of publicEvents) {
      assertRequiredEventFields(event);
      assert.equal(Object.prototype.hasOwnProperty.call(event, 'risk_score'), false);
    }
  });
});
