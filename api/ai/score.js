import {
  calculateRiskScore,
  clampRiskScore,
  getRiskLevel,
  hasRequiredScoreFields,
} from '../../shared/risk-score-spec.js';

const MODEL_TIMEOUT_MS = 2500;

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
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Tạo một bo huy de khong che thoi gian chay của AI
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500); // Demo chi nen chờ toi da 2.5s

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
  let source = 'ai_model';
  let fallback_used = false;

  try {
    risk_score = await scoreWithAiModel(event);
  } catch {
    // Shared scorer fallback is mandatory when model fails, times out, or returns invalid data.
    risk_score = fallbackScore;
    source = 'shared_scorer';
    fallback_used = true;
  }

  if (!Number.isFinite(risk_score)) {
    risk_score = fallbackScore;
    source = 'shared_scorer';
    fallback_used = true;
  }

  const safeScore = clampRiskScore(risk_score);
  res.status(200).json({
    risk_score: safeScore,
    source,
    fallback_used,
    threshold: getRiskLevel(safeScore),
  });
}