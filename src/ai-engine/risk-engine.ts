export function calculateRiskScore(severity: number, distance: number): number {
  // Logic: Severity càng cao -> Risk cao. Distance càng xa -> Risk giảm.
  // Công thức: Score = (Severity * 100) * (Hệ số khoảng cách)
  
  const distanceDecay = Math.max(0, 1 - distance / 15); // Ảnh hưởng trong bán kính 15km
  const finalScore = (severity * 100) * distanceDecay;
  
  return Math.round(finalScore);
}
/**  
 *1. Hàm tính điểm Fallback (Rule-based)
 * Dùng khi AI bị lỗi hoặc Timeout, đảm bảo luôn có kết quả cho demo 
*/
 const EVENT_WEIGHTS: Record <string, number> = {
    'conflict' : 0.95,
    'natural_disater': 0.85,
    'infrastructure': 0.70,
    'general': 0.40
 };
 export function calculateFallbackScore(type: string, severity: number): number {
    const weight = EVENT_WEIGHTS[type] || 0.5;
    //Cong thuc co dinh de on dinh diem so 
    let score = (weight * 70 ) + (severity * 30 );
    return Math.min(Math.max(Math.round(score),0),100);
 } 
 /**
  * 2. Hàm wrapper main (Fail Dectection)
  */
 export async function getRiskAssessment ( 
    aiCall : Promise<number>,
    eventData: {type: string, severity: number}
 ) {
    try {
        // chot chan 1.5s 
        const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("AI_TIMEOUT")), 1500)
    );

    // Đua giữa AI va Timeout
    const score = await Promise.race([aiCall, timeout]) as number;

    if (typeof score != 'number'|| score < 0 || score > 100) {
        throw new Error ("INVALID_SCORE ");
    }
    return {
        risk_score: score,
        scoring_source: 'ai',
        scoring_status: 'ok'
    };
} catch (error: unknown) {
    const message = error instanceof Error ? error.message : "AI_UNKOWN_ERROR";
    //2. Deterministic fallback 
    console.warn('[AI_ENGINE] Fallback triggered: ${message}');
    // Tu dong kich hoat Fallback khi co loi 
    const fallbackScore = calculateFallbackScore(eventData.type, eventData.severity);
    
    return {
        risk_score: fallbackScore,
        scoring_source: 'rule_based',
        scoring_status: 'fallback'
    };
}
 }
// AI Engineer: Use canonical getRiskLevel from shared/risk-score-spec.js
// Ensures consistent mapping: 'green' | 'yellow' | 'red' across the system
export { getRiskLevel } from '../../shared/risk-score-spec.js';