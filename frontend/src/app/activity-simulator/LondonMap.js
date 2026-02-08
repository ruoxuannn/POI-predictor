'use client';

import { useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const LONDON_CENTER = [51.5074, -0.1278];
const LONDON_ZOOM = 10;

export default function LondonMap({ pubs, maxProxy, selectedOsmId, selectedPubActivityIndex }) {
  const markers = useMemo(() => {
    return pubs.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  }, [pubs]);

  return (
    <MapContainer
      center={LONDON_CENTER}
      zoom={LONDON_ZOOM}
      style={{ height: '100%', width: '100%', borderRadius: 12 }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {markers.map((p) => {
        const level = maxProxy > 0 ? Math.min(1, p.simulatedProxy / maxProxy) : 0.5;
        const radius = 4 + level * 14;
        const opacity = 0.4 + level * 0.5;
        const isSelected = p.osm_id === selectedOsmId;
        const label = isSelected && selectedPubActivityIndex != null
          ? `${p.name || p.osm_id}: ${selectedPubActivityIndex}`
          : `${p.name || p.osm_id}: ${p.simulatedProxy}`;
        const tooltipKey = `${p.osm_id}-${selectedOsmId}-${isSelected ? selectedPubActivityIndex : ''}`;
        return (
          <CircleMarker
            key={p.osm_id}
            center={[p.lat, p.lng]}
            radius={radius}
            pathOptions={{
              fillColor: isSelected ? '#1d4ed8' : '#3b82f6',
              color: isSelected ? '#1e3a8a' : '#1d4ed8',
              weight: isSelected ? 2 : 1,
              fillOpacity: opacity,
              opacity: 0.9,
            }}
            eventHandlers={{
              mouseover: (e) => e.target.setStyle({ weight: 2 }),
              mouseout: (e) => e.target.setStyle({ weight: isSelected ? 2 : 1 }),
            }}
          >
            <Tooltip key={tooltipKey} permanent={isSelected}>
              {label}
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
