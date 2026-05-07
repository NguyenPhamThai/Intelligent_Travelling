import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import handler from '../api/ai/score.js';

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

function createRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    },
  };
}

function makeEvent(overrides = {}) {
  return {
    id: 'evt-test-1',
    type: 'riot',
    severity: 0.8,
    location: { lat: 10.77, lon: 106.7 },
    timestamp: Date.now(),
    ...overrides,
  };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  Object.keys(process.env).forEach((key) => {
    if (!(key in originalEnv)) delete process.env[key];
  });
  Object.assign(process.env, originalEnv);
});

describe('/api/ai/score contract', () => {
  it('returns 400 when id is missing', async () => {
    const req = {
      method: 'POST',
      body: { type: 'riot', severity: 0.7, location: { lat: 1, lon: 2 }, timestamp: Date.now() },
    };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 400);
    assert.ok(Array.isArray(res.payload.required));
  });

  it('returns 400 when required fields are missing', async () => {
    const req = { method: 'POST', body: { type: 'riot', severity: 0.7, location: { lat: 1, lon: 2 } } };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 400);
    assert.ok(Array.isArray(res.payload.required));
  });

  it('falls back to shared scorer when AI service fails', async () => {
    process.env.AI_SCORE_MODEL_URL = 'https://ai.example/score';
    globalThis.fetch = async () => {
      throw new Error('model unavailable');
    };

    const req = { method: 'POST', body: makeEvent() };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.fallback_used, true);
    assert.equal(res.payload.source, 'shared_scorer');
    assert.equal(typeof res.payload.risk_score, 'number');
    assert.ok(Number.isFinite(res.payload.risk_score));
    assert.ok(res.payload.risk_score >= 0 && res.payload.risk_score <= 100);
  });

  it('falls back when AI service returns invalid score', async () => {
    process.env.AI_SCORE_MODEL_URL = 'https://ai.example/score';
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ risk_score: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    const req = { method: 'POST', body: makeEvent() };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.fallback_used, true);
    assert.equal(res.payload.source, 'shared_scorer');
    assert.ok(typeof res.payload.risk_score === 'number');
    assert.ok(res.payload.risk_score >= 0 && res.payload.risk_score <= 100);
  });

  it('falls back when AI score is outside 0..100', async () => {
    process.env.AI_SCORE_MODEL_URL = 'https://ai.example/score';
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ risk_score: 101 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    const req = { method: 'POST', body: makeEvent() };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.fallback_used, true);
    assert.equal(res.payload.source, 'shared_scorer');
    assert.ok(res.payload.risk_score >= 0 && res.payload.risk_score <= 100);
  });

  it('uses AI score when service returns a valid number', async () => {
    process.env.AI_SCORE_MODEL_URL = 'https://ai.example/score';
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ risk_score: 88 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    const req = { method: 'POST', body: makeEvent() };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.fallback_used, false);
    assert.equal(res.payload.source, 'ai_model');
    assert.equal(res.payload.risk_score, 88);
  });
});
