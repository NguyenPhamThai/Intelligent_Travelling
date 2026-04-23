import { SafetyEvent } from "../../shared/safety-types";

export function classifyEvent(description: string): SafetyEvent['type'] {
  const text = description.toLowerCase();
  
  if (text.includes("mưa") || text.includes("bão") || text.includes("lụt")) return "weather";
  if (text.includes("biểu tình") || text.includes("bạo động")) return "riot";
  if (text.includes("trộm") || text.includes("cướp") || text.includes("tấn công")) return "crime";
  
  return "disaster";
}