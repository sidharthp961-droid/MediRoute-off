import { useEffect } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import { EmergencyTrip, JunctionTask } from '../types';

interface OfficerMapProps {
  trip: EmergencyTrip | null;
  junctions: JunctionTask[];
  selectedJunctionId: string | null;
  onSelectJunction: (id: string) => void;
}

// Map re-centerer helper component
function MapController({
  center,
  zoom,
}: {
  center: [number, number];
  zoom: number;
}) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: true });
  }, [center, zoom, map]);
  return null;
}

// ── Custom Leaflet Icons ──

const ambulanceIcon = L.divIcon({
  className: 'custom-ambulance-marker',
  html: `
    <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
      <div class="ambulance-pulse-ring"></div>
      <div style="width: 32px; height: 32px; border-radius: 50%; background: #e11d48; border: 2px solid #ffffff; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(225,29,72,0.6); z-index: 10;">
        <span style="font-size: 16px;">🚑</span>
      </div>
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const hospitalIcon = L.divIcon({
  className: 'custom-hospital-marker',
  html: `
    <div style="width: 30px; height: 30px; border-radius: 8px; background: #0284c7; border: 2px solid #ffffff; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">
      <span style="font-size: 15px;">🏥</span>
    </div>
  `,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

function getJunctionIcon(status: JunctionTask['status'], isSelected: boolean) {
  let bgColor = '#f59e0b'; // PENDING = amber
  let badgeIcon = '⏳';

  if (status === 'ASSIGNED') {
    bgColor = '#2563eb'; // blue
    badgeIcon = '👮';
  } else if (status === 'CLEARING') {
    bgColor = '#f97316'; // orange
    badgeIcon = '🚧';
  } else if (status === 'CLEARED') {
    bgColor = '#10b981'; // green
    badgeIcon = '✅';
  }

  const border = isSelected ? '3px solid #38bdf8' : '2px solid #ffffff';
  const scale = isSelected ? 'scale(1.15)' : 'scale(1)';

  return L.divIcon({
    className: 'custom-junction-marker',
    html: `
      <div style="transform: ${scale}; transition: all 0.2s; width: 28px; height: 28px; border-radius: 50%; background: ${bgColor}; border: ${border}; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.6);">
        <span style="font-size: 13px;">${badgeIcon}</span>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

// Default fallback route coordinates along SH 8 / SH 41 (Thodupuzha -> Ernakulam)
const DEFAULT_CORRIDOR_LINE: [number, number][] = [
  [9.8965, 76.718], // Thodupuzha
  [9.9142, 76.697], // Vengalloor
  [9.948, 76.643],  // Vazhakulam
  [9.983, 76.578],  // Muvattupuzha
  [9.981, 76.471],  // Kolenchery
  [9.953, 76.352],  // Thrippunithura
  [9.967, 76.319],  // Vyttila
  [9.962, 76.294],  // Medical Trust Hospital Ernakulam
];

export function OfficerMap({
  trip,
  junctions,
  selectedJunctionId,
  onSelectJunction,
}: OfficerMapProps) {
  const ambulancePos: [number, number] = trip
    ? [trip.currentLocation.lat, trip.currentLocation.lng]
    : [9.9312, 76.2673]; // Kochi center

  const destinationPos: [number, number] = trip
    ? [trip.destination.lat, trip.destination.lng]
    : [9.962, 76.294];

  const routePolyline: [number, number][] =
    trip && trip.routeCoordinates && trip.routeCoordinates.length > 0
      ? trip.routeCoordinates
      : DEFAULT_CORRIDOR_LINE;

  return (
    <div className="w-full h-full min-h-[380px] sm:min-h-[460px] rounded-2xl overflow-hidden border border-police-border/90 shadow-2xl relative">
      <MapContainer
        center={ambulancePos}
        zoom={11}
        scrollWheelZoom={true}
        className="w-full h-full"
      >
        <MapController center={ambulancePos} zoom={11} />

        {/* Dark Tactical Map Tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Highway Corridor Polyline */}
        <Polyline
          positions={routePolyline}
          pathOptions={{
            color: '#38bdf8',
            weight: 5,
            opacity: 0.85,
            dashArray: '8, 8',
          }}
        />

        {/* Emergency Vehicle Marker */}
        {trip && (
          <Marker position={ambulancePos} icon={ambulanceIcon}>
            <Popup>
              <div className="p-1 space-y-1 text-xs">
                <div className="font-bold text-rose-400 flex items-center gap-1">
                  <span>🚑 Ambulance Unit #{trip.vehicleId}</span>
                </div>
                <div>Condition: {trip.patientCondition}</div>
                <div>Speed / ETA: ~{trip.etaMinutes} mins remaining</div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Destination Hospital Marker */}
        {trip && (
          <Marker position={destinationPos} icon={hospitalIcon}>
            <Popup>
              <div className="p-1 space-y-1 text-xs">
                <div className="font-bold text-sky-400">🏥 {trip.destinationName}</div>
                <div className="text-slate-300">Corridor Endpoint</div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Junction Checkpoint Markers */}
        {junctions.map((jnc) => {
          const isSelected = selectedJunctionId === jnc.id;
          return (
            <Marker
              key={jnc.id}
              position={[jnc.location.lat, jnc.location.lng]}
              icon={getJunctionIcon(jnc.status, isSelected)}
              eventHandlers={{
                click: () => onSelectJunction(jnc.id),
              }}
            >
              <Popup>
                <div className="p-1 space-y-1 text-xs min-w-[180px]">
                  <div className="font-bold text-white">{jnc.name}</div>
                  <div className="text-[11px] text-slate-300">{jnc.landmark}</div>
                  <div className="flex items-center justify-between border-t border-slate-700 pt-1 mt-1">
                    <span className="text-slate-400">Status:</span>
                    <span className="font-bold uppercase text-sky-300">{jnc.status}</span>
                  </div>
                  {jnc.assignedOfficerName && (
                    <div className="text-[11px] text-slate-300">
                      Officer: <span className="font-semibold text-white">{jnc.assignedOfficerName}</span>
                    </div>
                  )}
                  {jnc.distanceFromAmbulanceMetres !== undefined && (
                    <div className="text-[11px] text-amber-300 font-mono">
                      Distance: {(jnc.distanceFromAmbulanceMetres / 1000).toFixed(1)} km
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Map Legend Overlay */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-police-navy/90 backdrop-blur-md border border-police-border px-3 py-2 rounded-xl text-[11px] flex flex-wrap items-center gap-3 shadow-lg">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <span className="text-slate-300">Pending</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          <span className="text-slate-300">Assigned</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
          <span className="text-slate-300">Clearing</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          <span className="text-slate-300">Cleared</span>
        </div>
      </div>
    </div>
  );
}
