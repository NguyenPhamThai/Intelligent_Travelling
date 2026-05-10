import {
  calculateRiskScore,
  clampRiskScore,
  getRiskLevel,
  hasRequiredScoreFields,
} from '../../shared/risk-score-spec.js';
import { incrementMetric } from '../_metrics.js';

const MODEL_TIMEOUT_MS = 2500;
// Rule-based fallback version for auditing
const FALLBACK_VERSION = 'rb-v1';

async function scoreWithAiModel(event) {
  const modelUrl = process.env.AI_SCORE_MODEL_URL;
  if (!modelUrl) {
    throw new Error('AI model URL is not configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);
  try {
    const response = await fetch(modelUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`AI model returned HTTP ${response.status}`);
    }
    const data = await response.json();
    const candidate = data?.risk_score ?? data?.score;
    const parsed = Number(candidate);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      throw new Error('AI model returned invalid risk score');
    }
    return parsed;
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const event = req.body && typeof req.body === 'object' ? req.body : {};
  if (!hasRequiredScoreFields(event)) {
    res.status(400).json({
      error: 'Invalid Event payload',
      required: ['type', 'severity', 'location', 'timestamp'],
    });
    return;
  }

  const fallbackScore = clampRiskScore(calculateRiskScore(event));
  let risk_score;
  let score_source = 'ai';
  let fallback_used = process.env.FORCE_RULE_BASED_SCORING === '1';
  let fallback_reason = undefined;

  if (fallback_used) {
    risk_score = fallbackScore;
    score_source = 'rule_based';
    fallback_reason = 'forced_by_env';
  }

  if (!fallback_used) {
    try {
      risk_score = await scoreWithAiModel(event);
    } catch (error) {
      // Deterministic rule-based fallback is mandatory when model fails or times out.
      risk_score = fallbackScore;
      score_source = 'rule_based';
      fallback_used = true;
      fallback_reason = error.message.includes('timeout')
        ? 'model_timeout'
        : error.message.includes('HTTP')
        ? 'model_http_error'
        : 'model_unavailable';
    }
  }

  if (!Number.isFinite(risk_score)) {
    risk_score = fallbackScore;
    score_source = 'rule_based';
    fallback_used = true;
    fallback_reason = 'invalid_score';
  }

  const safeScore = clampRiskScore(risk_score);
  // Emit metric for fallback usage
  try {
    if (fallback_used) incrementMetric('ai.fallback_used');
  } catch (e) {
    console.warn('Metric increment failed', e.message);
  }

  res.status(200).json({
    risk_score: safeScore,
    score_source,
    source: score_source,
    fallback_used,
    fallback_reason,
    threshold: getRiskLevel(safeScore),
    fallback_version: FALLBACK_VERSION,
  });
}
