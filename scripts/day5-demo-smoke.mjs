import assert from 'node:assert/strict';
import eventsHandler from '../api/events.js';
import aiScoreHandler from '../api/ai/score.js';

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

async function main() {
  console.log('[smoke] start day5 critical path');

  const page1 = await eventsHandler(
    new Request('http://localhost/api/events?lat=21.0285&lon=105.8542&radius=10000&page=1&page_size=2&sort=risk_score:desc')
  );
  const page2 = await eventsHandler(
    new Request('http://localhost/api/events?lat=21.0285&lon=105.8542&radius=10000&page=2&page_size=2&sort=risk_score:desc')
  );
  const empty = await eventsHandler(
    new Request('http://localhost/api/events?lat=0&lon=0&radius=1&page=1&page_size=10')
  );

  assert.equal(page1.status, 200);
  assert.equal(page2.status, 200);
  assert.equal(empty.status, 200);

  const page1Payload = await page1.json();
  const page2Payload = await page2.json();
  const emptyPayload = await empty.json();

  const p1Ids = new Set(page1Payload.events.map((event) => event.id));
  const overlap = page2Payload.events.filter((event) => p1Ids.has(event.id));
  assert.equal(overlap.length, 0, 'pagination overlap detected');
  assert.equal(Array.isArray(emptyPayload.events), true);
  assert.equal(emptyPayload.total, 0);

  const aiRes = createAiRes();
  process.env.FORCE_RULE_BASED_SCORING = '1';
  await aiScoreHandler(
    {
      method: 'POST',
      body: {
        id: 'smoke-event-1',
        type: 'riot',
        severity: 0.7,
        location: { lat: 10.77, lon: 106.7 },
        timestamp: Date.now(),
      },
    },
    aiRes,
  );

  assert.equal(aiRes.statusCode, 200);
  assert.equal(aiRes.payload.source, 'rule_based');
  assert.equal(aiRes.payload.fallback_used, true);

  console.log('[smoke] PASS day5 critical path');
}

main().catch((error) => {
  console.error('[smoke] FAIL day5 critical path', error);
  process.exitCode = 1;
});
