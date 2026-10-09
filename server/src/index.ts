// ══════════════════════════════════════════════════════════════
// MediRoute Officer Alert Server — Main Entry Point
// ══════════════════════════════════════════════════════════════

import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
import { setupOfficerSocketHandlers } from './socket';
import { coreBridge } from './coreBridge';
import { officerState } from './state';
import { alertDeduplicator } from './deduplication';
import { buildJunctionTasksForTrip } from './junctions';
import {
  requireServerAuthentication,
  REGISTERED_OFFICERS,
  generateOfficerToken,
  activeOfficers,
} from './auth';
import {
  validateDispatchPayload,
  isValidClearanceStatus,
  isValidCoordinates,
} from './validation';
import {
  OfficerClientToServerEvents,
  OfficerServerToClientEvents,
  EmergencyTrip,
} from './types';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3002', 10);
const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Socket.IO server with LAN permissive CORS
const io = new Server<OfficerClientToServerEvents, OfficerServerToClientEvents>(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 20_000,
  pingInterval: 10_000,
});

setupOfficerSocketHandlers(io);

// ── Health Endpoint ──
app.get('/api/health', (_req, res) => {
  const bridgeStatus = coreBridge.getStatus();
  const activeTrip = officerState.getActiveTrip();

  res.json({
    status: 'ok',
    service: 'MediRoute Officer Alert Server',
    port: PORT,
    uptime: Math.round(process.uptime()),
    timestamp: Date.now(),
    coreServerBridge: {
      connected: bridgeStatus.connected,
      coreUrl: bridgeStatus.coreUrl,
      lastPing: bridgeStatus.lastPing,
    },
    activeTripsCount: officerState.activeTrips.size,
    hasActiveEmergency: !!activeTrip,
  });
});

// ── Officer Authentication Endpoints ──
app.get('/api/v1/auth/roster', (_req, res) => {
  res.json({ officers: REGISTERED_OFFICERS });
});

app.post('/api/v1/auth/login', (req, res) => {
  const { officerId, badgeNumber, customName, station } = req.body || {};

  // Check if known officer in roster
  let officer = REGISTERED_OFFICERS.find(
    (o) => o.id === officerId || o.badgeNumber.toLowerCase() === badgeNumber?.toLowerCase(),
  );

  if (!officer) {
    if (!customName || customName.trim().length < 2) {
      return res.status(400).json({
        error: 'Please select a registered officer or provide a valid name and station',
      });
    }

    officer = {
      id: `off-temp-${Date.now().toString().slice(-4)}`,
      badgeNumber: badgeNumber || 'KP-DUTY-TEMP',
      name: customName.trim(),
      station: station || 'General Traffic Unit',
      role: 'officer',
    };
  }

  const token = generateOfficerToken(officer);
  officer.token = token;
  activeOfficers.set(token, officer);

  officerState.addAuditLog({
    action: 'OFFICER_LOGGED_IN',
    actorId: officer.id,
    actorName: officer.name,
    details: { station: officer.station, badge: officer.badgeNumber },
  });

  return res.json({
    success: true,
    officer,
    token,
  });
});

// ── Authenticated Server-to-Server Dispatch Ingestion ──
app.post('/api/v1/emergency-dispatch', requireServerAuthentication, (req, res) => {
  const data = req.body;
  const validation = validateDispatchPayload(data);

  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const sig = alertDeduplicator.createSignature(data.tripId, data.vehicleId);
  const isDuplicate = alertDeduplicator.isDuplicateEvent(sig);
  const shouldAlarm = alertDeduplicator.shouldTriggerAudibleAlarm(data.tripId);

  const existing = officerState.getTrip(data.tripId);
  const junctions =
    existing?.junctions ||
    buildJunctionTasksForTrip(data.tripId, data.origin, data.routeCoordinates);

  const trip: EmergencyTrip = {
    tripId: data.tripId,
    vehicleId: data.vehicleId,
    priority: data.priority || 'CRITICAL',
    patientCondition: data.patientCondition || 'Emergency Ambulance Corridor Activated',
    origin: data.origin,
    originName: data.originName || 'Hospital Hub',
    destination: data.destination,
    destinationName: data.destinationName || 'Destination Hospital',
    currentLocation: data.currentLocation || data.origin,
    routeCoordinates: data.routeCoordinates || [],
    totalDistanceKm: data.totalDistanceKm || '45.0 km',
    etaMinutes: data.etaMinutes || 35,
    status: 'ACTIVE',
    startedAt: data.startedAt || Date.now(),
    updatedAt: Date.now(),
    junctions,
    isSimulated: !!data.isSimulated,
  };

  officerState.addOrUpdateTrip(trip);

  officerState.addAuditLog({
    tripId: trip.tripId,
    action: 'DISPATCH_INGESTED_VIA_REST',
    actorId: 'server-to-server',
    actorName: 'MediRoute Dispatch API',
    details: {
      priority: trip.priority,
      isDuplicate,
      alarmTriggered: shouldAlarm,
      isSimulated: trip.isSimulated,
    },
  });

  // Emit to all connected officer screens
  io.emit('officer:alert', {
    trip,
    isNew: !existing,
    alarmTrigger: shouldAlarm,
    alertMessage: `🚨 ${trip.priority} ALERT: Ambulance #${trip.vehicleId.slice(0, 6)} -> ${trip.destinationName}. Clearance required.`,
  });

  return res.status(200).json({
    success: true,
    tripId: trip.tripId,
    isDuplicate,
    alarmTriggered: shouldAlarm,
    junctionsCount: trip.junctions.length,
  });
});

// ── Live Trip Location Telemetry Ingestion ──
app.post('/api/v1/trips/:tripId/location', requireServerAuthentication, (req, res) => {
  const { tripId } = req.params;
  const { location, distanceRemainingKm, etaMinutes } = req.body || {};

  if (!isValidCoordinates(location)) {
    return res.status(400).json({ error: 'Valid location coordinates are required' });
  }

  const updated = officerState.updateTripLocation(
    tripId,
    location,
    distanceRemainingKm,
    etaMinutes,
  );

  if (!updated) {
    return res.status(404).json({ error: 'Trip not found' });
  }

  io.emit('trip:location-update', {
    tripId,
    currentLocation: updated.currentLocation,
    distanceRemainingKm: updated.totalDistanceKm,
    etaMinutes: updated.etaMinutes,
    junctions: updated.junctions,
  });

  return res.json({ success: true, trip: updated });
});

// ── Query Active Trips and Junctions ──
app.get('/api/v1/trips/active', (_req, res) => {
  const trip = officerState.getActiveTrip();
  return res.json({ trip: trip || null });
});

app.get('/api/v1/junctions/:tripId', (req, res) => {
  const trip = officerState.getTrip(req.params.tripId);
  if (!trip) {
    return res.status(404).json({ error: 'Trip not found' });
  }
  return res.json({ junctions: trip.junctions });
});

// ── REST Junction Status Update ──
app.post('/api/v1/junctions/:tripId/:junctionId/status', (req, res) => {
  const { tripId, junctionId } = req.params;
  const { status, officerId, officerName, station, notes } = req.body || {};

  if (!isValidClearanceStatus(status)) {
    return res.status(400).json({ error: 'Invalid clearance status' });
  }

  const result = officerState.updateJunctionStatus(
    tripId,
    junctionId,
    status,
    { id: officerId || 'rest-officer', name: officerName || 'Traffic Officer', station },
    notes,
  );

  if (!result) {
    return res.status(404).json({ error: 'Trip or junction not found' });
  }

  io.emit('junction:status-changed', {
    tripId,
    junction: result.junction,
    updatedBy: officerName || 'Traffic Officer',
  });

  return res.json({ success: true, junction: result.junction });
});

// ── Audit Logs ──
app.get('/api/v1/audit-logs', (req, res) => {
  const tripId = req.query.tripId as string | undefined;
  const logs = officerState.getAuditLogs(tripId);
  return res.json({ logs });
});

// Start Server and Core Bridge
server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  ════════════════════════════════════════════════════════════');
  console.log('  🛡️   MEDIROUTE OFFICER ALERT & CLEARANCE SERVER   🛡️');
  console.log('  ════════════════════════════════════════════════════════════');
  console.log(`  ► Local:   http://localhost:${PORT}`);
  console.log(`  ► Network: http://0.0.0.0:${PORT}`);
  console.log(`  ► Core:    ${coreBridge.getStatus().coreUrl}`);
  console.log('  ► Socket.IO & REST endpoints ready for Traffic Units');
  console.log('  ════════════════════════════════════════════════════════════');
  console.log('');

  // Start background bridge connection to Core Server
  coreBridge.connect();
});

export { app, server };
