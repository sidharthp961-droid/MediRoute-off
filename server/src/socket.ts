// ══════════════════════════════════════════════════════════════
// MediRoute Officer Alert Server — Socket.IO Handlers
// ══════════════════════════════════════════════════════════════

import { Server, Socket } from 'socket.io';
import { officerState } from './state';
import { coreBridge } from './coreBridge';
import { isValidClearanceStatus } from './validation';
import {
  OfficerClientToServerEvents,
  OfficerServerToClientEvents,
  OfficerUser,
} from './types';

type OfficerIOServer = Server<OfficerClientToServerEvents, OfficerServerToClientEvents>;
type OfficerIOSocket = Socket<OfficerClientToServerEvents, OfficerServerToClientEvents>;

export function setupOfficerSocketHandlers(io: OfficerIOServer): void {
  coreBridge.setIoServer(io);

  io.on('connection', (socket: OfficerIOSocket) => {
    console.log(`[Officer Socket] Client connected: ${socket.id}`);

    // Send initial system state immediately upon connection
    const activeTrip = officerState.getActiveTrip();
    if (activeTrip) {
      socket.emit('officer:alert', {
        trip: activeTrip,
        isNew: false,
        alarmTrigger: false, // Don't blast siren on page refresh
        alertMessage: `Active corridor in progress: ${activeTrip.destinationName}`,
      });
    }

    const bridgeStatus = coreBridge.getStatus();
    socket.emit('core-bridge:status', {
      connectedToCore: bridgeStatus.connected,
      coreUrl: bridgeStatus.coreUrl,
      lastPing: bridgeStatus.lastPing,
    });

    // ── Officer Registration ──
    socket.on('officer:register', (data) => {
      const { officerId, badgeNumber, name, station } = data || {};
      if (!officerId || !name) {
        socket.emit('error', { message: 'officerId and name are required' });
        return;
      }

      const officerUser: OfficerUser = {
        id: officerId,
        badgeNumber: badgeNumber || 'KP-UNKNOWN',
        name,
        station: station || 'General Traffic Unit',
        role: 'officer',
      };

      officerState.connectedOfficerSockets.set(socket.id, officerUser);

      officerState.addAuditLog({
        action: 'OFFICER_CONNECTED',
        actorId: officerId,
        actorName: name,
        details: { socketId: socket.id, station: officerUser.station },
      });
    });

    // ── Junction Status Coordination ──
    socket.on('junction:update-status', (data) => {
      const { tripId, junctionId, status, officerId, officerName, notes } = data || {};

      if (!isValidClearanceStatus(status)) {
        socket.emit('error', {
          message: 'Invalid status. Must be PENDING, ASSIGNED, CLEARING, or CLEARED',
        });
        return;
      }

      const registeredOfficer = officerState.connectedOfficerSockets.get(socket.id);
      const officerData = {
        id: officerId || registeredOfficer?.id || 'officer-anon',
        name: officerName || registeredOfficer?.name || 'On-Duty Officer',
        station: registeredOfficer?.station,
      };

      const result = officerState.updateJunctionStatus(
        tripId,
        junctionId,
        status,
        officerData,
        notes,
      );

      if (!result) {
        socket.emit('error', { message: 'Trip or junction not found' });
        return;
      }

      // Broadcast junction status change to ALL connected officers and dashboards
      io.emit('junction:status-changed', {
        tripId,
        junction: result.junction,
        updatedBy: officerData.name,
      });

      console.log(
        `🚦 [Junction Clearance] ${result.junction.name} -> ${status} by ${officerData.name}`,
      );
    });

    // ── Trip Acknowledged ──
    socket.on('trip:acknowledge', (data) => {
      const { tripId, officerId } = data || {};
      const officer = officerState.connectedOfficerSockets.get(socket.id);

      officerState.addAuditLog({
        tripId,
        action: 'TRIP_ALERT_ACKNOWLEDGED',
        actorId: officerId || officer?.id || 'unknown',
        actorName: officer?.name || 'On-Duty Officer',
        details: { socketId: socket.id },
      });
    });

    // ── Disconnect ──
    socket.on('disconnect', () => {
      const officer = officerState.connectedOfficerSockets.get(socket.id);
      if (officer) {
        officerState.connectedOfficerSockets.delete(socket.id);
        officerState.addAuditLog({
          action: 'OFFICER_DISCONNECTED',
          actorId: officer.id,
          actorName: officer.name,
          details: { socketId: socket.id },
        });
      }
    });
  });
}
