process.env.IS_TEST_RUNNER = 'true';
process.env.NODE_ENV = 'test';

import http from 'http';
import { app, server } from '../src/index';
import { getServiceToken } from '../src/auth';
import { alertDeduplicator } from '../src/deduplication';
import { haversineDistance, buildJunctionTasksForTrip, updateJunctionDistances } from '../src/junctions';
import { isValidCoordinates, isValidClearanceStatus, validateDispatchPayload } from '../src/validation';
import { officerState } from '../src/state';

let testPort = 3099;
let testServer: http.Server;

function request(
  method: string,
  path: string,
  headers: Record<string, string> = {},
  body?: any,
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const dataString = body ? JSON.stringify(body) : '';
    const req = http.request(
      `http://127.0.0.1:${testPort}${path}`,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(dataString),
          ...headers,
        },
      },
      (res) => {
        let resData = '';
        res.on('data', (chunk) => (resData += chunk));
        res.on('end', () => {
          let parsed = {};
          try {
            parsed = JSON.parse(resData);
          } catch {
            parsed = resData;
          }
          resolve({ status: res.statusCode || 500, body: parsed });
        });
      },
    );

    req.on('error', reject);
    if (dataString) req.write(dataString);
    req.end();
  });
}

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`  ❌ [FAIL] ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`  ✅ [PASS] ${msg}`);
}

async function runTests() {
  console.log('════════════════════════════════════════════════════════════════');
  console.log('MEDIROUTE — OFFICER ALERT SERVER AUTOMATED AUDIT SUITE');
  console.log('════════════════════════════════════════════════════════════════\n');

  // Start test server instance
  await new Promise<void>((resolve) => {
    testServer = app.listen(testPort, '127.0.0.1', () => {
      resolve();
    });
  });

  try {
    // ── TEST GROUP 1: Health Endpoint ──
    console.log('--- TEST GROUP 1: Health & System Diagnostics ---');
    const healthRes = await request('GET', '/api/health');
    assert(healthRes.status === 200, 'Health endpoint returns HTTP 200');
    assert(healthRes.body.status === 'ok', 'Health status is ok');
    assert(healthRes.body.service === 'MediRoute Officer Alert Server', 'Correct service identifier reported');
    assert(typeof healthRes.body.coreServerBridge === 'object', 'Core server bridge diagnostics included');

    // ── TEST GROUP 2: Coordinate & Input Validation ──
    console.log('\n--- TEST GROUP 2: Coordinate & Input Validation ---');
    assert(isValidCoordinates({ lat: 9.983, lng: 76.578 }), 'Valid Kerala coordinates pass validation');
    assert(!isValidCoordinates({ lat: 95, lng: 76 }), 'Latitude > 90 rejected');
    assert(!isValidCoordinates({ lat: 9, lng: 200 }), 'Longitude > 180 rejected');
    assert(!isValidCoordinates(null), 'Null coordinates rejected');
    assert(!isValidCoordinates({ lat: '9.98', lng: 76.5 }), 'String coordinates rejected');

    assert(isValidClearanceStatus('PENDING'), 'PENDING is valid status');
    assert(isValidClearanceStatus('ASSIGNED'), 'ASSIGNED is valid status');
    assert(isValidClearanceStatus('CLEARING'), 'CLEARING is valid status');
    assert(isValidClearanceStatus('CLEARED'), 'CLEARED is valid status');
    assert(!isValidClearanceStatus('UNKNOWN_STATUS'), 'Invalid status rejected');

    const invalidPayload = validateDispatchPayload({ tripId: '123' });
    assert(!invalidPayload.valid, 'Incomplete dispatch payload rejected');

    // ── TEST GROUP 3: Authentication & Security ──
    console.log('\n--- TEST GROUP 3: Authentication & Security ---');
    const unauthDispatch = await request('POST', '/api/v1/emergency-dispatch', {}, {
      tripId: 'test-trip-01',
      vehicleId: 'amb-01',
      origin: { lat: 9.8965, lng: 76.718 },
      destination: { lat: 9.967, lng: 76.319 },
    });
    assert(unauthDispatch.status === 401, 'Unauthenticated dispatch request rejected with HTTP 401');

    const authHeaders = { 'x-officer-service-token': getServiceToken() };
    const authDispatch = await request('POST', '/api/v1/emergency-dispatch', authHeaders, {
      tripId: 'test-trip-01',
      vehicleId: 'amb-01',
      priority: 'CRITICAL',
      origin: { lat: 9.8965, lng: 76.718 },
      destination: { lat: 9.967, lng: 76.319 },
      originName: 'Thodupuzha Hub',
      destinationName: 'Vyttila Medical Center',
    });
    assert(authDispatch.status === 200, 'Authenticated dispatch accepted with HTTP 200');
    assert(authDispatch.body.alarmTriggered === true, 'First dispatch event fires audible alarm');
    assert(authDispatch.body.junctionsCount > 0, 'Junction clearance tasks automatically instantiated');

    // Test Officer Login
    const officerLogin = await request('POST', '/api/v1/auth/login', {}, {
      officerId: 'off-kl-02',
    });
    assert(officerLogin.status === 200, 'Registered officer login returns HTTP 200');
    assert(officerLogin.body.officer.name === 'SI Vinod Kumar', 'Correct officer identity returned');
    assert(typeof officerLogin.body.token === 'string', 'Security token generated');

    // ── TEST GROUP 4: Deduplication & Alarm Suppression ──
    console.log('\n--- TEST GROUP 4: Deduplication & Duplicate Alarm Suppression ---');
    const dupDispatch = await request('POST', '/api/v1/emergency-dispatch', authHeaders, {
      tripId: 'test-trip-01',
      vehicleId: 'amb-01',
      priority: 'CRITICAL',
      origin: { lat: 9.8965, lng: 76.718 },
      destination: { lat: 9.967, lng: 76.319 },
    });
    assert(dupDispatch.status === 200, 'Duplicate dispatch payload accepted idempotently');
    assert(dupDispatch.body.isDuplicate === true, 'Duplicate signature detected and flagged');
    assert(dupDispatch.body.alarmTriggered === false, 'Duplicate event did NOT re-trigger audible alarm');

    // ── TEST GROUP 5: Junction Clearance Progression ──
    console.log('\n--- TEST GROUP 5: Junction Clearance Lifecycle ---');
    const trip = officerState.getTrip('test-trip-01');
    assert(!!trip, 'Active trip exists in server state');
    assert(trip!.junctions.length >= 6, 'Preset Kerala corridor junctions built');

    const firstJnc = trip!.junctions[0];
    assert(firstJnc.status === 'PENDING', 'Initial junction status is PENDING');

    // Transition PENDING -> ASSIGNED
    const assignRes = await request(
      'POST',
      `/api/v1/junctions/test-trip-01/${firstJnc.id}/status`,
      {},
      {
        status: 'ASSIGNED',
        officerId: 'off-kl-02',
        officerName: 'SI Vinod Kumar',
        station: 'Muvattupuzha Traffic Enforcement Unit',
        notes: 'Moving to junction position',
      },
    );
    assert(assignRes.status === 200, 'Junction assignment returns HTTP 200');
    assert(assignRes.body.junction.status === 'ASSIGNED', 'Status updated to ASSIGNED');
    assert(assignRes.body.junction.assignedOfficerName === 'SI Vinod Kumar', 'Officer assigned recorded');

    // Transition ASSIGNED -> CLEARING
    const clearingRes = await request(
      'POST',
      `/api/v1/junctions/test-trip-01/${firstJnc.id}/status`,
      {},
      {
        status: 'CLEARING',
        officerId: 'off-kl-02',
        officerName: 'SI Vinod Kumar',
        notes: 'Halting cross-traffic from bypass',
      },
    );
    assert(clearingRes.body.junction.status === 'CLEARING', 'Status updated to CLEARING');

    // Transition CLEARING -> CLEARED
    const clearedRes = await request(
      'POST',
      `/api/v1/junctions/test-trip-01/${firstJnc.id}/status`,
      {},
      {
        status: 'CLEARED',
        officerId: 'off-kl-02',
        officerName: 'SI Vinod Kumar',
        notes: 'Green corridor clear. Traffic halted.',
      },
    );
    assert(clearedRes.body.junction.status === 'CLEARED', 'Status updated to CLEARED');

    // ── TEST GROUP 6: Real-time Telemetry & Junction Distance Updates ──
    console.log('\n--- TEST GROUP 6: Real-time Telemetry & Distance Recalculation ---');
    const newAmbulanceLoc = { lat: 9.948, lng: 76.643 }; // At Vazhakulam
    const locRes = await request(
      'POST',
      '/api/v1/trips/test-trip-01/location',
      authHeaders,
      {
        location: newAmbulanceLoc,
        distanceRemainingKm: '32.4 km',
        etaMinutes: 24,
      },
    );
    assert(locRes.status === 200, 'Telemetry update returns HTTP 200');
    assert(locRes.body.trip.currentLocation.lat === 9.948, 'Trip location updated');

    const vazhakulamJnc = locRes.body.trip.junctions.find((j: any) => j.name.includes('Vazhakulam'));
    assert(!!vazhakulamJnc, 'Vazhakulam junction found');
    assert(vazhakulamJnc.distanceFromAmbulanceMetres < 100, 'Distance recalculated: within 100m of junction');

    // ── TEST GROUP 7: Audit Logs ──
    console.log('\n--- TEST GROUP 7: Audit Trail Verification ---');
    const auditRes = await request('GET', '/api/v1/audit-logs?tripId=test-trip-01');
    assert(auditRes.status === 200, 'Audit logs fetched');
    assert(Array.isArray(auditRes.body.logs), 'Audit logs is array');
    assert(auditRes.body.logs.length >= 4, 'All junction and dispatch events logged');
    const actions = auditRes.body.logs.map((l: any) => l.action);
    assert(actions.includes('JUNCTION_STATUS_CHANGED_CLEARED'), 'CLEARED transition recorded in audit trail');

    console.log('\n════════════════════════════════════════════════════════════════');
    console.log('SUMMARY: ALL OFFICER ALERT SERVER AUDIT TESTS PASSED! (100% OK)');
    console.log('════════════════════════════════════════════════════════════════\n');
    process.exit(0);
  } finally {
    testServer.close();
    server.close();
  }
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
