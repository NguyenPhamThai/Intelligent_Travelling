import React from "react";
import { useEventFilter, EventType } from "./useEventFilter";

/** Fake component Map */
const Map = ({
  children,
}: {
  children: React.ReactNode;
  zoom: number;
  center: { lat: number; lng: number };
}) => <div className="map">{children}</div>;

/** Fake component Marker */
const Marker = ({
  tooltip,
}: {
  position: { lat: number; lng: number };
  icon: string;
  tooltip: string;
}) => <div>{tooltip}</div>;

const defaultCenter = {
  lat: 10.8231,
  lng: 106.6297,
};

const getMarkerIcon = (score: number): string => {
  if (score < 30) return "green";
  if (score <= 70) return "yellow";
  return "red";
};

interface LegendProps {
  activeFilters: string[];
  onToggle: (key: string) => void;
}

const Legend = ({ activeFilters, onToggle }: LegendProps) => (
  <div className="map-legend">
    <h4>Độ nguy hiểm</h4>

    {[
      { key: "green", label: "An toàn (<30)", color: "#2ecc71" },
      { key: "yellow", label: "Cảnh báo (30-70)", color: "#f1c40f" },
      { key: "red", label: "Nguy hiểm (>70)", color: "#e74c3c" },
    ].map((item) => (
      <div
        key={item.key}
        onClick={() => onToggle(item.key)}
        style={{
          opacity: activeFilters.includes(item.key) ? 1 : 0.3,
          cursor: "pointer",
        }}
      >
        <span
          style={{
            backgroundColor: item.color,
            display: "inline-block",
            width: "10px",
            height: "10px",
            borderRadius: "50%",
            marginRight: "8px",
          }}
        ></span>
        {item.label}
      </div>
    ))}
  </div>
);

export const SafetyMap = ({
  allEvents,
}: {
  allEvents: EventType[];
}) => {
  const { filteredEvents, activeFilters, toggleFilter } =
    useEventFilter(allEvents);

  return (
    <div className="map-container">
      <Legend
        activeFilters={activeFilters}
        onToggle={toggleFilter}
      />

      <Map zoom={12} center={defaultCenter}>
        {filteredEvents.map((event: EventType) => (
          <Marker
            key={event.id}
            position={event.location}
            icon={getMarkerIcon(event.risk_score)}
            tooltip={event.type}
          />
        ))}
      </Map>
    </div>
  );
};
