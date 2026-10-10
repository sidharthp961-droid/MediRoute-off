// ─── MediRoute Officer Alert Server — Resilient Core Server Bridge ───
import { io as ioClient, Socket } from 'socket.io-client';
import { officerState } from './state';
import { alertDeduplicator } from './deduplication';
import { buildJunctionTasksForTrip } from './junctions';
import { EmergencyTrip, Coordinates, JunctionTask } from './types';
import { Server } from 'socket.io';
import { OfficerClientToServerEvents, OfficerServerToClientEvents } from './types';

type OfficerIOServer = Server<OfficerClientToServerEvents, OfficerServerToClientEvents>;

export class CoreServerBridge {
  private socket: Socket | null = null;
  private isConnected = false;
  private lastPing = 0;
  private ioServer: OfficerIOServer | null = null;
  private coreUrl: string;

  constructor() {
    this.coreUrl = process.env.CORE_SERVER_URL || 'http://localhost:3001';
  }

  setIoServer(io: OfficerIOServer): void {
    this.ioServer = io;
  }

  getStatus(): { connected: boolean; coreUrl: string; lastPing: number } {
    return {
      connected: this.isConnected,
      coreUrl: this.coreUrl,
      lastPing: this.lastPing,
    };
  }

  connect(): void {
    console.log(`[Core Bridge] Connecting to MediRoute Core Server at ${this.coreUrl}...`);

    this.socket = ioClient(this.coreUrl, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      this.isConnected = true;
      this.lastPing = Date.now();
      console.log('✅ [Core Bridge] Successfully connected to MediRoute Core Server');

      // Register this socket with core server as an authorized officer-bridge link
      this.socket?.emit('vehicle:register', {
        role: 'officer-bridge',
        label: 'Officer Alert Server Link',
      } as any);

      // If active trip exists, sync its junctions immediately upon connection/reconnection
      const activeTrip = officerState.getActiveTrip();
      if (activeTrip && activeTrip.junctions && activeTrip.junctions.length > 0) {
        this.syncJunctions(activeTrip.tripId, activeTrip.junctions);
      }

      this.broadcastBridgeStatus();
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      console.warn(`⚠️ [Core Bridge] Disconnected from Core Server: ${reason}. Will reconnect...`);
      this.broadcastBridgeStatus();
    });

    this.socket.on('connect_error', (err) => {
      this.isConnected = false;
      console.warn(`[Core Bridge] Connection attempt to ${this.coreUrl} pending: ${err.message}`);
      this.broadcastBridgeStatus();
    });

    // Listen to Core Server emergency updates
    this.socket.on('emergency:update', (data: any) => {
      this.lastPing = Date.now();
      const session = data?.session;
      if (!session) return;

      if (session.status === 'active') {
        this.handleActiveEmergencySession(session);
      } else if (session.status === 'completed' || session.status === 'cancelled') {
        this.handleEndedEmergencySession(session.id, session.status.toUpperCase() as any);
      }
    });

    // Listen to vehicle telemetry (ambulance movement)
    this.socket.on('vehicle:updated', (data: any) => {
      const v = data?.vehicle;
      if (!v || v.role !== 'emergency' || !v.location) return;

      const activeTrip = officerState.getActiveTrip();
      if (activeTrip && activeTrip.status === 'ACTIVE') {
        const updated = officerState.updateTripLocation(activeTrip.tripId, v.location);
        if (updated && this.ioServer) {
          this.ioServer.emit('trip:location-update', {
            tripId: updated.tripId,
            currentLocation: updated.currentLocation,
            distanceRemainingKm: updated.totalDistanceKm,
            etaMinutes: updated.etaMinutes,
            junctions: updated.junctions,
          });
        }
      }
    });
  }

  /**
   * Synchronizes active junction tasks with MediRoute Core Server.
   */
  syncJunctions(tripId: string, junctions: JunctionTask[]): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('corridor:junctions-sync', {
        tripId,
        junctions,
      });
      console.log(`[Core Bridge] Synced ${junctions.length} junctions to Core Server for ${tripId}`);
    }
  }

  /**
   * Forwards junction clearance status changes to MediRoute Core Server.
   */
  notifyJunctionStatus(tripId: string, junction: JunctionTask, updatedBy: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('junction:update-status', {
        tripId,
        junctionId: junction.id,
        junction,
        status: junction.status,
        officerId: junction.assignedOfficerId,
        officerName: updatedBy,
        station: junction.assignedOfficerStation,
        notes: junction.notes,
      });
      console.log(`[Core Bridge] Forwarded junction update to Core Server: ${junction.name} -> ${junction.status} (${updatedBy})`);
    }
  }

  /**
   * Forwards emergency corridor trip acknowledgement to MediRoute Core Server.
   */
  notifyTripAcknowledged(tripId: string, acknowledgedBy: string, acknowledgedAt: number): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('trip:acknowledged', {
        tripId,
        acknowledgedBy,
        acknowledgedAt,
      });
      console.log(`[Core Bridge] Forwarded trip acknowledgement to Core Server: ${tripId} by ${acknowledgedBy}`);
    }
  }

  /**
   * Translates incoming Core Server session into a rich emergency trip for officers.
   */
  handleActiveEmergencySession(session: {
    id: string;
    vehicleId: string;
    origin: Coordinates;
    destination: Coordinates | null;
  }): void {
    const tripId = `trip-${session.id.slice(0, 8)}`;
    const sig = alertDeduplicator.createSignature(tripId, session.vehicleId);

    // Check duplicate event packet
    const isDup = alertDeduplicator.isDuplicateEvent(sig);
    const existingTrip = officerState.getTrip(tripId);

    if (existingTrip && existingTrip.status === 'ACTIVE' && isDup) {
      // Duplicate packet within cooldown; ignore repeat alarm
      return;
    }

    const isAlreadyAcknowledged = !!existingTrip?.acknowledged;
    const shouldAlarm = !isAlreadyAcknowledged && alertDeduplicator.shouldTriggerAudibleAlarm(tripId);

    const destCoords: Coordinates = session.destination || { lat: 9.967, lng: 76.319 };
    const junctions = buildJunctionTasksForTrip(tripId, session.origin);

    const trip: EmergencyTrip = existingTrip || {
      tripId,
      vehicleId: session.vehicleId,
      priority: 'CRITICAL',
      patientCondition: 'Emergency Ambulance Corridor Activated',
      origin: session.origin,
      originName: 'District Hospital Thodupuzha Hub',
      destination: destCoords,
      destinationName: 'Ernakulam Medical Trust / Multi-Speciality Hub',
      currentLocation: session.origin,
      routeCoordinates: [],
      totalDistanceKm: '58.2 km',
      etaMinutes: 45,
      status: 'ACTIVE',
      startedAt: Date.now(),
      updatedAt: Date.now(),
      junctions,
      isSimulated: false,
      acknowledged: false,
    };

    officerState.addOrUpdateTrip(trip);

    officerState.addAuditLog({
      tripId,
      action: 'EMERGENCY_DISPATCH_RECEIVED_FROM_CORE',
      actorId: 'core-server-bridge',
      actorName: 'MediRoute Core Server',
      details: {
        origin: session.origin,
        destination: destCoords,
        priority: trip.priority,
        alarmTriggered: shouldAlarm,
      },
    });

    if (this.ioServer) {
      this.ioServer.emit('officer:alert', {
        trip,
        isNew: !existingTrip,
        alarmTrigger: shouldAlarm,
        alertMessage: `🚨 CRITICAL EMERGENCY CORRIDOR: Ambulance #${session.vehicleId.slice(0, 6)} en-route. Clearance required at ${junctions.length} junctions.`,
      });
    }

    // Immediately sync the generated junctions to Core Server
    this.syncJunctions(tripId, junctions);
  }

  private handleEndedEmergencySession(sessionId: string, status: 'COMPLETED' | 'CANCELLED'): void {
    const tripId = `trip-${sessionId.slice(0, 8)}`;
    const trip = officerState.endTrip(tripId, status);
    if (trip && this.ioServer) {
      this.ioServer.emit('trip:status-update', {
        tripId,
        status,
        reason: `Trip ${status.toLowerCase()} by primary command centre`,
      });
    }
  }

  private broadcastBridgeStatus(): void {
    if (this.ioServer) {
      this.ioServer.emit('core-bridge:status', {
        connectedToCore: this.isConnected,
        coreUrl: this.coreUrl,
        lastPing: this.lastPing,
      });
    }
  }
}

export const coreBridge = new CoreServerBridge();
