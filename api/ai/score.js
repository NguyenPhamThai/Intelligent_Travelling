import { calculateRiskScore, getThreshold } from '../../shared/risk-score-spec.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const event = req.body && typeof req.body === 'object' ? req.body : {};
    const risk_score = calculateRiskScore(event);

    res.status(200).json({
      risk_score,
      source: 'heuristic_v0',
      fallback_used: false,
      threshold: getThreshold(risk_score),
    });
  } catch {
    res.status(200).json({
      risk_score: 50,
      source: 'fallback_mock',
      fallback_used: true,
      threshold: 'yellow',
    });
  }
}
