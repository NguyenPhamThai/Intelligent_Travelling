import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import eventsHandler from '../api/events.js';

function assertEventShape(event) {
  assert.equal(typeof event.id, 'string');
  assert.ok(event.id.length > 0);
  assert.equal(typeof event.type, 'string');
  assert.ok(['riot', 'crime', 'weather'].includes(event.type));
  assert.equal(typeof event.severity, 'number');
  assert.ok(Number.isFinite(event.severity));
  assert.equal(typeof event.timestamp, 'number');
  assert.ok(Number.isFinite(event.timestamp));
  assert.equal(typeof event.location, 'object');
  assert.equal(typeof event.location.lat, 'number');
  assert.equal(typeof event.location.lng, 'number');
  assert.equal(typeof event.risk_score, 'number');
  assert.ok(Number.isFinite(event.risk_score));
  assert.ok(event.risk_score >= 0 && event.risk_score <= 100, 'risk_score must be 0-100');
  assert.equal(typeof event.source, 'string');
  assert.ok(['ai', 'rule_based'].includes(event.source), 'source must be ai or rule_based');
  assert.equal(typeof event.fallback_used, 'boolean');
  assert.ok(['green', 'yellow', 'red'].includes(event.threshold));
  // New metadata fields
  assert.equal(typeof event.source, 'string', 'source (score_source) must be present');
  if (event.fallback_reason !== undefined) {
    assert.equal(typeof event.fallback_reason, 'string');
  }
}

describe('/api/events contract lock', () => {
  it('keeps response schema stable for pagination metadata and event payload', async () => {
    const response = await eventsHandler(
      new Request('http://localhost/api/events?lat=21.0285&lon=105.8542&radius=10000&page=1&page_size=2&sort=risk_score:desc')
    );
    assert.equal(response.status, 200);

    const payload = await response.json();
    assert.ok(Array.isArray(payload.events));
    assert.equal(typeof payload.total, 'number');
    assert.equal(typeof payload.has_next, 'boolean');
    assert.equal(typeof payload.page, 'number');
    assert.equal(typeof payload.page_size, 'number');
    assert.equal(typeof payload.timestamp, 'number');
    assert.equal(typeof payload.query, 'object');
    assert.equal(typeof payload.query.lat, 'number');
    assert.equal(typeof payload.query.lon, 'number');
    assert.equal(typeof payload.query.radius_km, 'number');

    assert.equal(typeof payload._freshness, 'object');
    assert.equal(typeof payload._freshness.generated_at, 'number');
    assert.equal(typeof payload._freshness.max_age_seconds, 'number');
    assert.equal(typeof payload._freshness.is_stale, 'boolean');

    for (const event of payload.events) {
      assertEventShape(event);
    }
  });

  it('always includes metadata headers in response', async () => {
    const response = await eventsHandler(
      new Request('http://localhost/api/events?lat=21.0285&lon=105.8542&radius=10000&page=1&page_size=10')
    );
    assert.equal(response.status, 200);

    // Check for metadata headers
    assert.ok(response.headers.has('X-Cache'), 'must include X-Cache header');
    assert.ok(
      ['HIT', 'MISS', 'BYPASS'].includes(response.headers.get('X-Cache')),
      'X-Cache must be HIT, MISS, or BYPASS'
    );
    assert.ok(response.headers.has('X-Score-Source'), 'must include X-Score-Source header');
    assert.ok(
      ['ai', 'rule_based', 'mixed'].includes(response.headers.get('X-Score-Source')),
      'X-Score-Source must be ai, rule_based, or mixed'
    );
    assert.ok(response.headers.has('X-Fallback-Count'), 'must include X-Fallback-Count header');
    assert.ok(response.headers.has('X-AI-Score-Count'), 'must include X-AI-Score-Count header');
  });

  it('guards against risk_score === 0 (green threshold)', async () => {
    const response = await eventsHandler(
      new Request('http://localhost/api/events?lat=21.0285&lon=105.8542&radius=10000&page=1&page_size=100')
    );
    assert.equal(response.status, 200);

    const payload = await response.json();
    const zeroRiskEvents = payload.events.filter((e) => e.risk_score === 0);
    
    if (zeroRiskEvents.length > 0) {
      // Verify zero risk scores still have valid structure
      for (const event of zeroRiskEvents) {
        assert.equal(event.risk_score, 0);
        assert.equal(event.threshold, 'green');
        assertEventShape(event);
      }
    }
  });
});
