// ══════════════════════════════════════════════════════════════
// MediRoute Officer Alert Server — State Management
// ══════════════════════════════════════════════════════════════

import {
  EmergencyTrip,
  JunctionTask,
  JunctionClearanceStatus,
  AuditLogEntry,
  OfficerUser,
  Coordinates,
} from './types';
import { updateJunctionDistances } from './junctions';
import { v4 as uuid } from 'uuid';

class OfficerServerState {
  activeTrips: Map<string, EmergencyTrip> = new Map();
  auditLogs: AuditLogEntry[] = [];
  connectedOfficerSockets: Map<string, OfficerUser> = new Map(); // socketId -> OfficerUser

  // ── Trip Management ──

  addOrUpdateTrip(trip: EmergencyTrip): void {
    this.activeTrips.set(trip.tripId, trip);
  }

  getTrip(tripId: string): EmergencyTrip | undefined {
    return this.activeTrips.get(tripId);
  }

  getActiveTrip(): EmergencyTrip | undefined {
    // Return most recently updated active trip
    const trips = Array.from(this.activeTrips.values()).filter((t) => t.status === 'ACTIVE');
    return trips.sort((a, b) => b.updatedAt - a.updatedAt)[0];
  }

  updateTripLocation(
    tripId: string,
    coords: Coordinates,
    distanceRemainingKm?: string,
    etaMinutes?: number,
  ): EmergencyTrip | undefined {
    const trip = this.activeTrips.get(tripId);
    if (!trip) return undefined;

    trip.currentLocation = coords;
    if (distanceRemainingKm) trip.totalDistanceKm = distanceRemainingKm;
    if (etaMinutes !== undefined) trip.etaMinutes = etaMinutes;
    trip.updatedAt = Date.now();

    // Recalculate junction distances
    trip.junctions = updateJunctionDistances(trip.junctions, coords);
    return trip;
  }

  endTrip(tripId: string, status: 'COMPLETED' | 'CANCELLED'): EmergencyTrip | undefined {
    const trip = this.activeTrips.get(tripId);
    if (!trip) return undefined;

    trip.status = status;
    trip.updatedAt = Date.now();
    return trip;
  }

  acknowledgeTrip(
    tripId: string,
    officer: { id: string; name: string },
  ): EmergencyTrip | undefined {
    const trip = this.activeTrips.get(tripId);
    if (!trip) return undefined;

    trip.acknowledged = true;
    trip.acknowledgedBy = officer.name;
    trip.acknowledgedAt = Date.now();
    trip.updatedAt = Date.now();

    this.addAuditLog({
      tripId,
      action: 'TRIP_ALERT_ACKNOWLEDGED',
      actorId: officer.id,
      actorName: officer.name,
      details: {
        acknowledgedAt: trip.acknowledgedAt,
      },
    });

    return trip;
  }

  // ── Junction Clearance Coordination ──

  updateJunctionStatus(
    tripId: string,
    junctionId: string,
    status: JunctionClearanceStatus,
    officer: { id: string; name: string; station?: string },
    notes?: string,
  ): { trip: EmergencyTrip; junction: JunctionTask } | undefined {
    const trip = this.activeTrips.get(tripId);
    if (!trip) return undefined;

    const jnc = trip.junctions.find((j) => j.id === junctionId);
    if (!jnc) return undefined;

    jnc.status = status;
    jnc.assignedOfficerId = officer.id;
    jnc.assignedOfficerName = officer.name;
    if (officer.station) jnc.assignedOfficerStation = officer.station;
    if (notes) jnc.notes = notes;
    jnc.lastUpdatedAt = Date.now();
    trip.updatedAt = Date.now();

    this.addAuditLog({
      tripId,
      junctionId,
      action: `JUNCTION_STATUS_CHANGED_${status}`,
      actorId: officer.id,
      actorName: officer.name,
      details: {
        junctionName: jnc.name,
        newStatus: status,
        notes: notes || '',
        station: officer.station || jnc.assignedOfficerStation,
      },
    });

    return { trip, junction: jnc };
  }

  // ── Audit Logging ──

  addAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): AuditLogEntry {
    const log: AuditLogEntry = {
      id: `aud-${uuid().slice(0, 8)}`,
      timestamp: Date.now(),
      ...entry,
    };
    this.auditLogs.unshift(log); // Prepend for reverse chronological order
    // Keep max 500 audit logs in memory
    if (this.auditLogs.length > 500) {
      this.auditLogs.length = 500;
    }
    return log;
  }

  getAuditLogs(tripId?: string, limit = 50): AuditLogEntry[] {
    if (tripId) {
      return this.auditLogs.filter((l) => l.tripId === tripId).slice(0, limit);
    }
    return this.auditLogs.slice(0, limit);
  }
}

export const officerState = new OfficerServerState();
