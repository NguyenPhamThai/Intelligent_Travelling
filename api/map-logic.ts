import { useState, useMemo } from 'react';

export const useEventFilter = (events: Event[]) => {
  // Trạng thái lưu các mức độ rủi ro đang được chọn (mặc định chọn tất cả)
  const [activeFilters, setActiveFilters] = useState<string[]>(['green', 'yellow', 'red']);

  const toggleFilter = (threshold: string) => {
    setActiveFilters(prev => 
      prev.includes(threshold) 
        ? prev.filter(t => t !== threshold) // Bỏ chọn
        : [...prev, threshold]              // Thêm lại vào filter
    );
  };

  const filteredEvents = useMemo(() => {
    return events.filter(evt => {
      const score = calculateRiskScore(evt);
      const threshold = getThreshold(score);
      return activeFilters.includes(threshold);
    });
  }, [events, activeFilters]);

  return { filteredEvents, activeFilters, toggleFilter };
};