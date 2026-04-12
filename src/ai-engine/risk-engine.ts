export function calculateRiskScore(severity: number, distance: number): number {
  // Logic: Severity càng cao -> Risk cao. Distance càng xa -> Risk giảm.
  // Công thức: Score = (Severity * 100) * (Hệ số khoảng cách)
  
  const distanceDecay = Math.max(0, 1 - distance / 15); // Ảnh hưởng trong bán kính 15km
  const finalScore = (severity * 100) * distanceDecay;
  
  return Math.round(finalScore);
}