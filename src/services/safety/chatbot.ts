// src/services/safety/chatbot.ts
export function processChatMessage(message: string): string {
  if (message.toLowerCase().includes('an toàn')) return 'Khu vực này an toàn với điểm số 75/100.';
  if (message.toLowerCase().includes('thời tiết')) return 'Thời tiết: Nắng, nhiệt độ 30°C.';
  return 'Hỏi gì khác đi!';
}