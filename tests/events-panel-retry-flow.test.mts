import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { UI_STATE_MAP } from '../shared/risk-score-spec.js';
import { loadEventsState } from '../src/components/EventsPanel';

describe('EventsPanel retry flow', () => {
  it('recovers from first failure to success on retry', async () => {
    let callCount = 0;

    const fetchMock: typeof fetch = async () => {
      callCount += 1;

      if (callCount === 1) {
        return new Response(JSON.stringify({ error: 'upstream unavailable' }), { status: 503 });
      }

      return new Response(
        JSON.stringify({
          events: [
            {
              id: 'evt-retry-1',
              title: 'Retry Success Event',
              type: 'riot',
              location: { lat: 21.0285, lon: 105.8542 },
              severity: 0.7,
              risk_score: 70,
              threshold: 'yellow',
              timestamp: 1775952000000,
            },
          ],
          total: 1,
          has_next: false,
          page: 1,
          page_size: 10,
          query: { sort: 'risk_score:desc' },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    };

    const firstAttempt = await loadEventsState(fetchMock);
    assert.equal(firstAttempt.uiState, UI_STATE_MAP.error);
    assert.equal(firstAttempt.events.length, 0);
    assert.equal(firstAttempt.error, 'Unable to load events. Please try again.');

    const retryAttempt = await loadEventsState(fetchMock);
    assert.equal(retryAttempt.uiState, UI_STATE_MAP.success);
    assert.equal(retryAttempt.error, null);
    assert.equal(retryAttempt.events.length, 1);
    assert.equal(retryAttempt.events[0]?.risk_score, 70);
    assert.equal(retryAttempt.events[0]?.threshold, 'yellow');
  });
});
