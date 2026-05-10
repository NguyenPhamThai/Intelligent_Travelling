import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateRisk } from '../src/services/safety/filter-rank';
import { calculateRiskScore } from '../shared/risk-score.js';

describe('safety filter-rank uses shared scorer', () => {
  it('delegates risk_score calculation to shared calculateRiskScore', () => {
    const event = {
      id: 'evt-safety-1',
      location: { lat: 10.77, lon: 106.7 },
      type: 'crime' as const,
      severity: 0.75,
      timestamp: Date.now(),
    };

    const expected = calculateRiskScore(event);
    const scored = calculateRisk({ ...event }, event.location.lat, event.location.lng);

    assert.equal(scored.risk_score, expected);
  });
});
