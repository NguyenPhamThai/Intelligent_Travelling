export const RISK_SCORE_MIN = 0;
export const RISK_SCORE_MAX = 100;

export const RISK_SCORE_THRESHOLDS = Object.freeze({
  green: 30,
  yellow: 70,
  red: 100,
});

const TYPE_WEIGHTS = Object.freeze({
  riot: 1.0,
  crime: 0.8,
  weather: 0.5,
  conflict: 0.95,
  natural_disaster: 0.85,
  infrastructure: 0.70,
  general: 0.40
});

export function clampRiskScore(score) {
  const parsed = Number(score);
  if (!Number.isFinite(parsed)) {
    return RISK_SCORE_MIN;
  }
  return Math.min(Math.max(parsed, RISK_SCORE_MIN), RISK_SCORE_MAX);
}

export function calculateRiskScore(event, aiScore = null) {
  const severity = Number(event?.severity ?? 0);
  const typeWeight = TYPE_WEIGHTS[event?.type] ?? 0.5;
  if(aiScore !== null && !isNaN(aiScore)){
    return clampRiskScore(aiScore);
  }
  //Neu khong co ai (Fallback), dung cong thuc Heuristic stable 
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