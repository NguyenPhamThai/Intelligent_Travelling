export function calculateRiskScore(severity: number, distance: number): number {
  // Logic: Severity càng cao -> Risk cao. Distance càng xa -> Risk giảm.
  // Công thức: Score = (Severity * 100) * (Hệ số khoảng cách)
  
  const distanceDecay = Math.max(0, 1 - distance / 15); // Ảnh hưởng trong bán kính 15km
  const finalScore = (severity * 100) * distanceDecay;
  
  return Math.round(finalScore);
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