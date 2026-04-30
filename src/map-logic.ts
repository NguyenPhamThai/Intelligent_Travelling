import { useState, useMemo } from "react";

/** Kiểu dữ liệu Event */
export interface EventType {
  id: number;
  type: string;
  risk_score: number;
  location: {
    lat: number;
    lng: number;
  };
}

/** Tính risk score */
const calculateRiskScore = (evt: EventType): number => {
  return evt.risk_score;
};

/** Xác định màu */
const getThreshold = (score: number): string => {
  if (score < 30) return "green";
  if (score <= 70) return "yellow";
  return "red";
};

export const useEventFilter = (events: EventType[]) => {
  const [activeFilters, setActiveFilters] = useState<string[]>([
    "green",
    "yellow",
    "red",
  ]);

  const toggleFilter = (threshold: string) => {
    setActiveFilters((prev: string[]) =>
      prev.includes(threshold)
        ? prev.filter((t: string) => t !== threshold)
        : [...prev, threshold]
    );
  };

  const filteredEvents = useMemo(() => {
    return events.filter((evt) => {
      const score = calculateRiskScore(evt);
      const threshold = getThreshold(score);
      return activeFilters.includes(threshold);
    });
  }, [events, activeFilters]);

  return {
    filteredEvents,
    activeFilters,
    toggleFilter,
  };
};
