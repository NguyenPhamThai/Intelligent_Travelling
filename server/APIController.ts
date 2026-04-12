import express from 'express';
import { calculateRiskScore, getThreshold } from './scoring';

const app = express();
app.use(express.json());

// Middleware giả lập X-Source header [cite: 151]
app.use((req, res, next) => {
  res.setHeader('X-Source', 'worldmonitor');
  next();
});

app.post('/api/ai/score', (req, res) => {
  try {
    const event = req.body;
    
    // Logic tính điểm (Model v0) [cite: 166]
    const riskScore = calculateRiskScore(event);
    
    // Trả về output theo contract yêu cầu trong ảnh
    return res.json({
      risk_score: riskScore,
      source: "heuristic_v0", // Nguồn thuật toán [cite: 166]
      fallback_used: false,  // Track nếu AI chết phải dùng fallback [cite: 233]
      threshold: getThreshold(riskScore)
    });
  } catch (error) {
    // Fallback khi có lỗi [cite: 233]
    return res.status(500).json({
      risk_score: 50,
      source: "fallback_mock",
      fallback_used: true,
      threshold: "yellow"
    });
  }
});