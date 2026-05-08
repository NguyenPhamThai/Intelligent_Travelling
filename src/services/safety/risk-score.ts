// src/services/safety/risk-score.ts
// Backward-compatible bridge to the shared scoring source of truth.
export { calculateRiskScore, clampRiskScore, getRiskLevel } from '../../../shared/risk-score-spec.js';
