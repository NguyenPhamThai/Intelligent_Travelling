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
    input: 'full Event',
    output: {
      risk_score: 'number',
      source: 'string',
      fallback_used: 'boolean',
      threshold: 'green|yellow|red',
    },
  },
});

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