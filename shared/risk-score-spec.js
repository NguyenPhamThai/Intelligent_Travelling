export const RISK_SCORE_MIN = 0;
export const RISK_SCORE_MAX = 100;

export const RISK_SCORE_THRESHOLDS = Object.freeze({
  green: 30,
  yellow: 70,
  red: 100,
});

export const UI_STATE_MAP = Object.freeze({
  loading: 'loading',
  error: 'error',
  success: 'success',
});

export const EVENT_CONTRACT = Object.freeze({
  required: Object.freeze({
    id: 'string',
    location: Object.freeze({ lat: 'number', lon: 'number' }),
    type: 'riot|crime|weather',
    severity: 'number',
    timestamp: 'number',
  }),
});

const TYPE_WEIGHTS = Object.freeze({
  riot: 1,
  crime: 0.8,
  weather: 0.5,
});

export const RISK_SCORE_SPEC = Object.freeze({
  scale: { min: RISK_SCORE_MIN, max: RISK_SCORE_MAX },
  formula: 'risk_score = clamp(severity × typeWeight × 100, 0..100)',
  typeWeights: TYPE_WEIGHTS,
  thresholds: RISK_SCORE_THRESHOLDS,
  uiStates: UI_STATE_MAP,
  apiContract: {
    input: {
      type: 'full Event',
      required: EVENT_CONTRACT.required,
    },
    output: {
      risk_score: 'number',
      source: 'string',
      fallback_used: 'boolean',
      threshold: 'green|yellow|red',
    },
  },
  examples: {
    request: {
      id: 'evt_20260412_001',
      location: { lat: 10.7769, lon: 106.7009 },
      type: 'riot',
      severity: 0.72,
      timestamp: 1775952000000,
    },
    response: {
      risk_score: 72,
      source: 'heuristic_v0',
      fallback_used: false,
      threshold: 'red',
    },
  },
});

export function isFullEvent(event) {
  return (
    !!event &&
    typeof event === 'object' &&
    typeof event.id === 'string' &&
    typeof event.location === 'object' &&
    typeof event.location?.lat === 'number' &&
    typeof event.location?.lon === 'number' &&
    typeof event.type === 'string' &&
    ['riot', 'crime', 'weather'].includes(event.type) &&
    typeof event.severity === 'number' &&
    typeof event.timestamp === 'number'
  );
}

export function clampRiskScore(score) {
  return Math.min(Math.max(score, RISK_SCORE_MIN), RISK_SCORE_MAX);
}

export function calculateRiskScore(event) {
  const severity = Number(event?.severity ?? 0);
  const typeWeight = TYPE_WEIGHTS[event?.type] ?? 0.5;
  return clampRiskScore(severity * typeWeight * 100);
}

export function getThreshold(score) {
  if (score < RISK_SCORE_THRESHOLDS.green) return 'green';
  if (score <= RISK_SCORE_THRESHOLDS.yellow) return 'yellow';
  return 'red';
}