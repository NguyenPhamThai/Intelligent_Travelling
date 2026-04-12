// Mapping trạng thái hiển thị [Yêu cầu trong ảnh]
enum UIState {
  LOADING = 'loading',
  ERROR = 'error',
  SUCCESS = 'success'
}

const EventMarker = ({ event }: { event: any }) => {
  // Xác định màu sắc dựa trên ngưỡng đã chốt [cite: 188]
  const getColor = (score: number) => {
    if (score < 30) return 'green';
    if (score <= 70) return 'orange'; // yellow
    return 'red';
  };

  return (
    <div style={{ color: getColor(event.risk_score) }}>
      📍 {event.type.toUpperCase()} ({event.risk_score})
    </div>
  );
};