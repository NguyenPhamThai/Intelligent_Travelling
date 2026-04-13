export interface SafetyEvent {
  id: string;          
  location: { 
    lat: number;       
    lon: number;       
  };
  type: "weather" | "crime" | "riot" | "disaster"; // Phân loại sự kiện
  severity: number;    // Độ nghiêm trọng từ nguồn tin (0.0 đến 1.0)
  risk_score: number;  // Điểm nguy hiểm do AI tính (0 đến 100)
  description: string; // Mô tả ngắn gọn về sự kiện
  timestamp: number;   // Thời gian xảy ra 
}
// Cấu trúc yêu cầu từ phía User 
export interface UserLocation {
  lat: number;
  lon: number;
  userId: string;
}