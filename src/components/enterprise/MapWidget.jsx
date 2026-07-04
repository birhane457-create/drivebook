import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { cn } from '@/lib/utils';

export default function MapWidget({ markers = [], center, zoom = 5, className }) {
  const defaultCenter = center || (markers[0] ? [markers[0].lat, markers[0].lng] : [0, 0]);
  return (
    <div className={cn('rounded-xl border bg-card overflow-hidden', className)}>
      <MapContainer center={defaultCenter} zoom={zoom} className="h-[320px] w-full" scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map((m, i) => (
          <CircleMarker key={i} center={[m.lat, m.lng]} radius={8} pathOptions={{ color: 'hsl(243 75% 59%)', fillColor: 'hsl(243 75% 59%)', fillOpacity: 0.7 }}>
            <Popup>
              <strong>{m.title}</strong>
              {m.subtitle && <div>{m.subtitle}</div>}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}