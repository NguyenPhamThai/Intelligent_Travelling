import { calculateRiskScore, getThreshold, isFullEvent } from '../../shared/risk-score-spec.js';

// Ham tinh toan du phong (Rule-based) de dam bao khong tra ve loi
function getSafetyFallback(event) {
  const weights = { 'Weather': 15, 'Crowd': 12, 'Security': 20, 'Health': 18 };
  const base = weights[event.type] || 10;
  const score = (event.severity || 1) * base;
  return Math.min(100, Math.max(0, score));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Tạo một bo huy de khong che thoi gian chay của AI
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500); // Demo chi nen chờ toi da 2.5s

  try {
    const event = req.body && typeof req.body === 'object' ? req.body : {};
    
    if (!isFullEvent(event)) {
      return res.status(400).json({ error: 'Invalid Event payload' });
    }

    // --- PHẦN NÂNG CẤP AI ---
    //Neu sau này bạn gọi một API AI Real, se dung signal: controller.signal
    let risk_score = calculateRiskScore(event);

    // Kiem  tra neu diem so bi loi hoặc NaN thì dung Fallback ngay
    if (isNaN(risk_score) || risk_score === null) {
      throw new Error('Invalid calculation');
    }

    clearTimeout(timeoutId); // Delete timeout neu chay xong kip luc

    res.status(200).json({
      risk_score,
      source: 'heuristic_v1_stable', 
      fallback_used: false,
      threshold: getThreshold(risk_score),
    });

  } catch (err) {
    // Khi co loi hoac TIMEOUT -> Tra ve du lieu an toan thay vi crash
    console.error('[AI-DEBUG] Triggering fallback due to:', err.name === 'AbortError' ? 'Timeout' : err.message);
    
    const fallbackScore = getSafetyFallback(req.body || {});
    
    res.status(200).json({
      risk_score: fallbackScore,
      source: 'emergency_fallback', 
      fallback_used: true,
      threshold: getThreshold(fallbackScore), // Dung Ham de lay mau 
    });
  }
}