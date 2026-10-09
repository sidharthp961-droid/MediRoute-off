// ══════════════════════════════════════════════════════════════
// MediRoute Officer Alert Server — Shared Type Definitions
// ══════════════════════════════════════════════════════════════

export interface Coordinates {
  lat: number;
  lng: number;
}

export type JunctionClearanceStatus = 'PENDING' | 'ASSIGNED' | 'CLEARING' | 'CLEARED';

export type TripPriority = 'CRITICAL' | 'URGENT' | 'ROUTINE';

export type TripStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface JunctionTask {
  id: string;
  tripId: string;
  name: string;
  landmark?: string;
  location: Coordinates;
  sequenceOrder: number;
  status: JunctionClearanceStatus;
  assignedOfficerId?: string;
  assignedOfficerName?: string;
  assignedOfficerStation?: string;
  distanceFromAmbulanceMetres?: number;
  etaSeconds?: number;
  notes?: string;
  lastUpdatedAt: number;
}

export interface EmergencyTrip {
  tripId: string;
  vehicleId: string;
  priority: TripPriority;
  patientCondition: string;
  origin: Coordinates;
  originName: string;
  destination: Coordinates;
  destinationName: string;
  currentLocation: Coordinates;
  routeCoordinates: [number, number][]; // [lat, lng]
  totalDistanceKm: string;
  etaMinutes: number;
  status: TripStatus;
  startedAt: number;
  updatedAt: number;
  junctions: JunctionTask[];
  isSimulated: boolean;
}

export interface OfficerUser {
  id: string;
  badgeNumber: string;
  name: string;
  station: string;
  role: 'officer' | 'supervisor';
  token?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  tripId?: string;
  junctionId?: string;
  action: string;
  actorId: string;
  actorName: string;
  details: Record<string, unknown>;
}

// ══════════════════════════════════════════════════════════════
// Socket.IO Event Contracts for Officer Alert Server
// ══════════════════════════════════════════════════════════════

export interface OfficerClientToServerEvents {
  'officer:register': (data: {
    officerId: string;
    badgeNumber: string;
    name: string;
    station: string;
  }) => void;

  'junction:update-status': (data: {
    tripId: string;
    junctionId: string;
    status: JunctionClearanceStatus;
    officerId: string;
    officerName: string;
    notes?: string;
  }) => void;

  'trip:acknowledge': (data: {
    tripId: string;
    officerId: string;
  }) => void;
}

export interface OfficerServerToClientEvents {
  'officer:alert': (data: {
    trip: EmergencyTrip;
    isNew: boolean;
    alarmTrigger: boolean;
    alertMessage: string;
  }) => void;

  'trip:location-update': (data: {
    tripId: string;
    currentLocation: Coordinates;
    distanceRemainingKm?: string;
    etaMinutes?: number;
    junctions: JunctionTask[];
  }) => void;

  'trip:status-update': (data: {
    tripId: string;
    status: TripStatus;
    reason?: string;
  }) => void;

  'junction:status-changed': (data: {
    tripId: string;
    junction: JunctionTask;
    updatedBy: string;
  }) => void;

  'audit:logged': (data: AuditLogEntry) => void;

  'core-bridge:status': (data: {
    connectedToCore: boolean;
    coreUrl: string;
    lastPing: number;
  }) => void;

  'error': (data: { message: string }) => void;
}
