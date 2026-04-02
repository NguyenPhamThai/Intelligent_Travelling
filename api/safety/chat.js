// api/safety/chat.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Missing message' });

  // Simple rule-based NLP
  let response = 'Sorry, I didn\'t understand.';
  if (message.toLowerCase().includes('an toàn')) response = 'Khu vực này có mức an toàn trung bình. Hãy kiểm tra bản đồ.';
  else if (message.toLowerCase().includes('thời tiết')) response = 'Thời tiết hiện tại: Mưa nhẹ. Đề nghị mang áo mưa.';

  res.json({ response });
}