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
} catch (err : any ) {
    const error = err as Error; // Ep kieu ve Error chuan 
    // Tu dong kich hoat Fallback khi co loi 
    const fallbackScore = calculateFallbackScore(eventData.type, eventData.severity);
    console.warn(`[AI_ENGINE] Chế độ Fallback được kích hoạt: ${error.message}`);

    return {
        risk_score: fallbackScore,
        scoring_source: 'rule_based',
        scoring_status: 'fallback'
    };
}
 }
/*
 * AI Engineer xác nhận Mapping 
 * Đảm bảo cùng một score sẽ ra cùng một màu trên toàn hệ thống
 */
export function getRiskLevel(score: number) {
    if (score > 70) {
        return { level: 'Nguy hiểm', color: 'Red', hex: '#e74c3c' }; // Nguy hiểm > 70
    }
    if (score >= 30) {
        return { level: 'Cảnh báo', color: 'Yellow', hex: '#f1c40f' }; // Cảnh báo 30-70
    }
    return { level: 'An toàn', color: 'Green', hex: '#2ecc71' }; // An toàn < 30
}