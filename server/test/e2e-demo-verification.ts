// ══════════════════════════════════════════════════════════════
// MediRoute — Live End-to-End Demo Verification Runner
// ══════════════════════════════════════════════════════════════

import http from 'http';
import { io as ioClient } from 'socket.io-client';

const OFFICER_SERVER_URL = 'http://127.0.0.1:3002';
const SERVICE_TOKEN = process.env.OFFICER_SERVICE_TOKEN || 'mr-officer-bridge-secure-key-2026';

function post(path: string, headers: Record<string, string>, body: any): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const dataStr = JSON.stringify(body);
    const req = http.request(`${OFFICER_SERVER_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataStr),
        ...headers,
      },
    }, (res) => {
      let raw = '';
      res.on('data', (c) => raw += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode || 500, data: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode || 500, data: raw });
        }
      });
    });
    req.on('error', reject);
    req.write(dataStr);
    req.end();
  });
}

function get(path: string): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const req = http.get(`${OFFICER_SERVER_URL}${path}`, (res) => {
      let raw = '';
      res.on('data', (c) => raw += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode || 500, data: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode || 500, data: raw });
        }
      });
    });
    req.on('error', reject);
  });
}

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`  ❌ [FAIL] ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`  ✅ [PASS] ${msg}`);
}

async function runDemo() {
  console.log('════════════════════════════════════════════════════════════════');
  console.log('LIVE END-TO-END DEMO & VALIDATION AGAINST RUNNING SERVICES');
  console.log('════════════════════════════════════════════════════════════════\n');

  // Step 1: Connect simulated Officer Dashboard socket to port 3002
  console.log('--- Step 1: Connect Officer Dashboard Client to Port 3002 ---');
  const officerSocket = ioClient(OFFICER_SERVER_URL);

  await new Promise<void>((resolve, reject) => {
    officerSocket.on('connect', () => {
      console.log('  -> Officer Dashboard socket connected successfully');
      // Register officer
      officerSocket.emit('officer:register', {
        officerId: 'off-kl-02',
        badgeNumber: 'KP-TR-4055',
        name: 'SI Vinod Kumar',
        station: 'Muvattupuzha Traffic Enforcement Unit',
      });
      resolve();
    });
    officerSocket.on('connect_error', reject);
  });

  // Setup event listeners for verification
  let alertReceived: any = null;
  let junctionChangedEvents: any[] = [];
  let telemetryReceived: any = null;

  officerSocket.on('officer:alert', (data) => {
    alertReceived = data;
  });

  officerSocket.on('junction:status-changed', (data) => {
    junctionChangedEvents.push(data);
  });

  officerSocket.on('trip:location-update', (data) => {
    telemetryReceived = data;
  });

  // Step 2: Start clearly labeled SIMULATED emergency trip
  console.log('\n--- Step 2: Start Authenticated SIMULATED Emergency Trip ---');
  const simTripId = `sim-trip-${Date.now().toString().slice(-4)}`;
  const simVehicleId = 'KL-07-EM-SIM-401';

  const dispatchRes = await post('/api/v1/emergency-dispatch', {
    'x-officer-service-token': SERVICE_TOKEN,
  }, {
    tripId: simTripId,
    vehicleId: simVehicleId,
    priority: 'CRITICAL',
    patientCondition: 'Simulated Demo Patient Corridor (Cardiac Emergency)',
    origin: { lat: 9.8965, lng: 76.718 },
    destination: { lat: 9.962, lng: 76.294 },
    originName: 'District Hospital Thodupuzha Hub',
    destinationName: 'Ernakulam Medical Trust Multi-Speciality Hub',
    isSimulated: true,
  });

  assert(dispatchRes.status === 200, 'Authenticated dispatch accepted (HTTP 200)');
  assert(dispatchRes.data.alarmTriggered === true, 'Audible alarm triggered on new trip');
  assert(dispatchRes.data.junctionsCount >= 6, 'Junction clearance checkpoints instantiated');

  // Wait 500ms for socket delivery
  await new Promise((r) => setTimeout(r, 500));
  assert(!!alertReceived, 'Officer Dashboard received officer:alert over WebSocket');
  assert(alertReceived.trip.tripId === simTripId, 'Alert matches simulated trip ID');
  assert(alertReceived.trip.isSimulated === true, 'Trip explicitly flagged isSimulated: true');

  // Step 3: Test Duplicate Event Protection
  console.log('\n--- Step 3: Verify Duplicate Event & Alarm Suppression ---');
  const dupRes = await post('/api/v1/emergency-dispatch', {
    'x-officer-service-token': SERVICE_TOKEN,
  }, {
    tripId: simTripId,
    vehicleId: simVehicleId,
    priority: 'CRITICAL',
    origin: { lat: 9.8965, lng: 76.718 },
    destination: { lat: 9.962, lng: 76.294 },
  });

  assert(dupRes.status === 200, 'Duplicate request safely accepted');
  assert(dupRes.data.isDuplicate === true, 'Deduplication engine detected duplicate signature');
  assert(dupRes.data.alarmTriggered === false, 'Audible alarm correctly suppressed on duplicate event');

  // Step 4: Acknowledge & Assign Junction to Officer
  console.log('\n--- Step 4: Acknowledge & Assign Junction to Officer ---');
  officerSocket.emit('trip:acknowledge', {
    tripId: simTripId,
    officerId: 'off-kl-02',
  });

  const activeTripRes = await get('/api/v1/trips/active');
  const firstJnc = activeTripRes.data.trip.junctions[0];
  assert(firstJnc.status === 'PENDING', 'Initial junction status is PENDING');

  // Assign junction to officer
  officerSocket.emit('junction:update-status', {
    tripId: simTripId,
    junctionId: firstJnc.id,
    status: 'ASSIGNED',
    officerId: 'off-kl-02',
    officerName: 'SI Vinod Kumar',
    notes: 'Officer at station responding to post',
  });

  await new Promise((r) => setTimeout(r, 400));
  const assignedEvent = junctionChangedEvents.find((e) => e.junction.status === 'ASSIGNED');
  assert(!!assignedEvent, 'Dashboard received junction:status-changed (ASSIGNED)');
  assert(assignedEvent.junction.assignedOfficerName === 'SI Vinod Kumar', 'Officer identity verified');

  // Step 5: Transition to CLEARING and CLEARED
  console.log('\n--- Step 5: Transition Junction: CLEARING -> CLEARED ---');
  officerSocket.emit('junction:update-status', {
    tripId: simTripId,
    junctionId: firstJnc.id,
    status: 'CLEARING',
    officerId: 'off-kl-02',
    officerName: 'SI Vinod Kumar',
    notes: 'Traffic stopped at bypass entrance',
  });

  await new Promise((r) => setTimeout(r, 400));
  const clearingEvent = junctionChangedEvents.find((e) => e.junction.status === 'CLEARING');
  assert(!!clearingEvent, 'Dashboard received junction:status-changed (CLEARING)');

  officerSocket.emit('junction:update-status', {
    tripId: simTripId,
    junctionId: firstJnc.id,
    status: 'CLEARED',
    officerId: 'off-kl-02',
    officerName: 'SI Vinod Kumar',
    notes: 'Green corridor clear. Traffic halted.',
  });

  await new Promise((r) => setTimeout(r, 400));
  const clearedEvent = junctionChangedEvents.find((e) => e.junction.status === 'CLEARED');
  assert(!!clearedEvent, 'Dashboard received junction:status-changed (CLEARED)');

  // Step 6: Verify Live Telemetry Broadcast
  console.log('\n--- Step 6: Verify Live Location Telemetry Broadcast ---');
  const telemetryRes = await post(`/api/v1/trips/${simTripId}/location`, {
    'x-officer-service-token': SERVICE_TOKEN,
  }, {
    location: { lat: 9.948, lng: 76.643 }, // Vazhakulam
    distanceRemainingKm: '32.1 km',
    etaMinutes: 24,
  });

  assert(telemetryRes.status === 200, 'Telemetry update accepted (HTTP 200)');
  await new Promise((r) => setTimeout(r, 400));
  assert(!!telemetryReceived, 'Dashboard received trip:location-update event');
  assert(telemetryReceived.currentLocation.lat === 9.948, 'Coordinates updated accurately');
  assert(telemetryReceived.distanceRemainingKm === '32.1 km', 'Distance remaining broadcasted');

  // Step 7: Verify Immutable Audit Logs
  console.log('\n--- Step 7: Verify Audit Trail Records All Actions ---');
  const auditRes = await get(`/api/v1/audit-logs?tripId=${simTripId}`);
  assert(auditRes.status === 200, 'Audit logs fetched (HTTP 200)');
  const logs = auditRes.data.logs;
  assert(Array.isArray(logs) && logs.length >= 4, 'Audit trail contains all lifecycle actions');

  const actions = logs.map((l: any) => l.action);
  assert(actions.includes('DISPATCH_INGESTED_VIA_REST'), 'Audit log contains DISPATCH_INGESTED_VIA_REST');
  assert(actions.includes('TRIP_ALERT_ACKNOWLEDGED'), 'Audit log contains TRIP_ALERT_ACKNOWLEDGED');
  assert(actions.includes('JUNCTION_STATUS_CHANGED_ASSIGNED'), 'Audit log contains JUNCTION_STATUS_CHANGED_ASSIGNED');
  assert(actions.includes('JUNCTION_STATUS_CHANGED_CLEARING'), 'Audit log contains JUNCTION_STATUS_CHANGED_CLEARING');
  assert(actions.includes('JUNCTION_STATUS_CHANGED_CLEARED'), 'Audit log contains JUNCTION_STATUS_CHANGED_CLEARED');

  officerSocket.disconnect();

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('END-TO-END DEMO VALIDATION: 100% SUCCESSFUL!');
  console.log('════════════════════════════════════════════════════════════════\n');
  process.exit(0);
}

runDemo().catch((err) => {
  console.error('Demo validation failed:', err);
  process.exit(1);
});
