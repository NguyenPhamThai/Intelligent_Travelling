import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import aiScoreHandler from '../api/ai/score.js';
import eventsHandler from '../api/events.js';

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

function createAiRes() {
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

afterEach(() => {
  globalThis.fetch = originalFetch;
  Object.keys(process.env).forEach((key) => {
    if (!(key in originalEnv)) delete process.env[key];
  });
  Object.assign(process.env, originalEnv);
});

describe('shared risk scorer contract across endpoints', () => {
  it('returns inspectable metadata and numeric risk_score on both endpoints', async () => {
    const eventsResponse = await eventsHandler(
      new Request('http://localhost/api/events?lat=21.0285&lon=105.8542&radius=500')
    );
    assert.equal(eventsResponse.status, 200);

    const eventsPayload = await eventsResponse.json();
    assert.ok(Array.isArray(eventsPayload.events));
    assert.ok(eventsPayload.events.length > 0);

    const eventFromEventsApi = eventsPayload.events[0];
    assert.equal(typeof eventFromEventsApi.risk_score, 'number');
    assert.equal(eventFromEventsApi.source, 'rule_based');
    assert.equal(eventFromEventsApi.fallback_used, false);
    assert.ok(['green', 'yellow', 'red'].includes(eventFromEventsApi.threshold));

    process.env.AI_SCORE_MODEL_URL = 'https://ai.example/score';
    globalThis.fetch = async () => {
      throw new Error('force fallback');
    };

    const aiReq = { method: 'POST', body: eventFromEventsApi };
    const aiRes = createAiRes();
    await aiScoreHandler(aiReq, aiRes);

    assert.equal(aiRes.statusCode, 200);
    assert.equal(typeof aiRes.payload.risk_score, 'number');
    assert.equal(aiRes.payload.source, 'rule_based');
    assert.equal(aiRes.payload.fallback_used, true);
    assert.ok(['green', 'yellow', 'red'].includes(aiRes.payload.threshold));

    // On forced AI failure both endpoints must resolve through the same shared scorer.
    assert.equal(aiRes.payload.risk_score, eventFromEventsApi.risk_score);
    assert.equal(aiRes.payload.threshold, eventFromEventsApi.threshold);
  });
});
