import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import scoreHandler from '../api/ai/score.js';

describe('/api/ai/score fallback behavior', () => {
  it('returns valid risk_score even on AI model timeout', async () => {
    // Simulate AI model unavailable by not setting AI_SCORE_MODEL_URL
    const originalUrl = process.env.AI_SCORE_MODEL_URL;
    delete process.env.AI_SCORE_MODEL_URL;

    try {
      const event = {
        id: 'test-evt-001',
        location: { lat: 10.7769, lon: 106.7009 },
        type: 'riot',
        severity: 0.72,
        timestamp: Date.now(),
      };

      const req = {
        method: 'POST',
        body: event,
      };

      let response;
      const res = {
        status: (code) => ({
          json: (data) => {
            response = { code, data };
          },
        }),
      };

      await scoreHandler(req, res);

      assert.ok(response, 'handler should respond');
      assert.equal(response.code, 200);
      
      const payload = response.data;
      assert.ok(Number.isFinite(payload.risk_score), 'risk_score must be finite number');
      assert.ok(payload.risk_score >= 0 && payload.risk_score <= 100, 'risk_score must be 0-100');
      assert.equal(payload.fallback_used, true, 'fallback_used must be true');
      assert.equal(payload.score_source, 'rule_based', 'score_source must be rule_based');
      assert.ok(payload.fallback_reason, 'fallback_reason must be present');
    } finally {
      if (originalUrl) process.env.AI_SCORE_MODEL_URL = originalUrl;
    }
  });

  it('includes fallback_reason when AI model unavailable', async () => {
    const originalUrl = process.env.AI_SCORE_MODEL_URL;
    delete process.env.AI_SCORE_MODEL_URL;

    try {
      const event = {
        id: 'test-evt-002',
        location: { lat: 10.7769, lon: 106.7009 },
        type: 'crime',
        severity: 0.85,
        timestamp: Date.now(),
      };

      const req = { method: 'POST', body: event };
      let response;
      const res = {
        status: (code) => ({
          json: (data) => {
            response = { code, data };
          },
        }),
      };

      await scoreHandler(req, res);

      assert.ok(response.data.fallback_reason, 'fallback_reason must be present');
      assert.equal(typeof response.data.fallback_reason, 'string');
    } finally {
      if (originalUrl) process.env.AI_SCORE_MODEL_URL = originalUrl;
    }
  });

  it('validates required Event fields', async () => {
    const incompleteEvent = {
      id: 'test-evt-003',
      type: 'riot',
      // missing location, severity, timestamp
    };

    const req = { method: 'POST', body: incompleteEvent };
    let response;
    const res = {
      status: (code) => ({
        json: (data) => {
          response = { code, data };
        },
      }),
    };

    await scoreHandler(req, res);

    assert.equal(response.code, 400, 'should return 400 for invalid payload');
    assert.ok(response.data.error, 'should include error message');
  });

  it('enforces score_source field (alias for source)', async () => {
    const originalUrl = process.env.AI_SCORE_MODEL_URL;
    delete process.env.AI_SCORE_MODEL_URL;

    try {
      const event = {
        id: 'test-evt-004',
        location: { lat: 10.7769, lon: 106.7009 },
        type: 'weather',
        severity: 0.5,
        timestamp: Date.now(),
      };

      const req = { method: 'POST', body: event };
      let response;
      const res = {
        status: (code) => ({
          json: (data) => {
            response = { code, data };
          },
        }),
      };

      await scoreHandler(req, res);

      // Both source and score_source should be in response
      assert.ok(response.data.source, 'source field must be present');
      assert.ok(response.data.score_source, 'score_source field must be present');
      assert.equal(response.data.source, response.data.score_source, 'source and score_source should match');
      assert.ok(['ai', 'rule_based'].includes(response.data.score_source), 'score_source must be ai or rule_based');
    } finally {
      if (originalUrl) process.env.AI_SCORE_MODEL_URL = originalUrl;
    }
  });

  it('clamps risk_score to 0-100 range', async () => {
    const originalUrl = process.env.AI_SCORE_MODEL_URL;
    delete process.env.AI_SCORE_MODEL_URL;

    try {
      const events = [
        { id: 'evt-1', location: { lat: 0, lon: 0 }, type: 'riot', severity: -10, timestamp: Date.now() },
        { id: 'evt-2', location: { lat: 0, lon: 0 }, type: 'crime', severity: 1000, timestamp: Date.now() },
      ];

      for (const event of events) {
        const req = { method: 'POST', body: event };
        let response;
        const res = {
          status: (code) => ({
            json: (data) => {
              response = { code, data };
            },
          }),
        };

        await scoreHandler(req, res);

        assert.ok(response.data.risk_score >= 0, 'risk_score must not be negative');
        assert.ok(response.data.risk_score <= 100, 'risk_score must not exceed 100');
      }
    } finally {
      if (originalUrl) process.env.AI_SCORE_MODEL_URL = originalUrl;
    }
  });
});
