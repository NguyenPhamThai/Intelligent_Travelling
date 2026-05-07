export const RISK_SCORE_MIN = 0;
export const RISK_SCORE_MAX = 100;

export const RISK_SCORE_THRESHOLDS = Object.freeze({
  green: 30,
  yellow: 70,
  red: 100,
});

const TYPE_WEIGHTS = Object.freeze({
  riot: 1,
  crime: 0.8,
  weather: 0.5,
});

export function clampRiskScore(score) {
  const parsed = Number(score);
  if (!Number.isFinite(parsed)) {
    return RISK_SCORE_MIN;
  }
  return Math.min(Math.max(parsed, RISK_SCORE_MIN), RISK_SCORE_MAX);
}

export function calculateRiskScore(event) {
  const severity = Number(event?.severity ?? 0);
  const typeWeight = TYPE_WEIGHTS[event?.type] ?? 0.5;
  return clampRiskScore(severity * typeWeight * 100);
}

export function getRiskLevel(score) {
  const normalized = clampRiskScore(score);
  if (normalized < RISK_SCORE_THRESHOLDS.green) return 'green';
  if (normalized <= RISK_SCORE_THRESHOLDS.yellow) return 'yellow';
  return 'red';
}

export function sanitizeRiskScore(score) {
  const parsed = Number(score);
  if (!Number.isFinite(parsed)) return null;
  return clampRiskScore(parsed);
}