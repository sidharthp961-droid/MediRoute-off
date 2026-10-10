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
  routeCoordinates: [number, number][];
  totalDistanceKm: string;
  etaMinutes: number;
  status: TripStatus;
  startedAt: number;
  updatedAt: number;
  junctions: JunctionTask[];
  isSimulated: boolean;
  acknowledged?: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: number;
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
