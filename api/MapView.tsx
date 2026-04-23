const Legend = ({ activeFilters, onToggle }: any) => (
  <div className="map-legend">
    <h4>Độ nguy hiểm (Click để lọc)</h4>
    {[
      { key: 'green', label: 'An toàn (<30)', color: '#2ecc71' },
      { key: 'yellow', label: 'Cảnh báo (30-70)', color: '#f1c40f' },
      { key: 'red', label: 'Nguy hiểm (>70)', color: '#e74c3c' }
    ].map(item => (
      <div 
        key={item.key}
        className={`legend-item ${activeFilters.includes(item.key) ? 'active' : 'inactive'}`}
        onClick={() => onToggle(item.key)}
        style={{ opacity: activeFilters.includes(item.key) ? 1 : 0.3, cursor: 'pointer' }}
      >
        <span style={{ backgroundColor: item.color }} className="dot"></span>
        {item.label}
      </div>
    ))}
  </div>
);

const SafetyMap = ({ allEvents }: { allEvents: Event[] }) => {
  const { filteredEvents, activeFilters, toggleFilter } = useEventFilter(allEvents);

  return (
    <div className="map-container">
      <Legend activeFilters={activeFilters} onToggle={toggleFilter} />
      
      {/* Giả định sử dụng Google Maps hoặc Leaflet */}
      <Map zoom={12} center={defaultCenter}>
        {filteredEvents.map(event => (
          <Marker 
            key={event.id}
            position={event.location}
            icon={getMarkerIcon(event.risk_score)} // Trả về màu theo threshold
            tooltip={event.type} // Hiển thị khi hover
          />
        ))}
      </Map>
    </div>
  );
};