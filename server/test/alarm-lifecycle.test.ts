process.env.IS_TEST_RUNNER = 'true';
process.env.NODE_ENV = 'test';

import http from 'http';
import { io as ioClient, Socket } from 'socket.io-client';
import { app, server } from '../src/index';
import { getServiceToken } from '../src/auth';
import { officerState } from '../src/state';
import { alertDeduplicator } from '../src/deduplication';

const testPort = 3098;
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

async function runAlarmLifecycleTests() {
  console.log('════════════════════════════════════════════════════════════════');
  console.log('MEDIROUTE — ALARM LIFECYCLE & MULTI-CLIENT AUDIT TEST SUITE');
  console.log('════════════════════════════════════════════════════════════════\n');

  // Start test server
  await new Promise<void>((resolve) => {
    testServer = server.listen(testPort, '127.0.0.1', () => {
      resolve();
    });
  });

  const authHeaders = { 'x-officer-service-token': getServiceToken() };

  // Connect two mock officer client sockets (Dashboard A and Dashboard B)
  const clientA: Socket = ioClient(`http://127.0.0.1:${testPort}`, { reconnection: false });
  const clientB: Socket = ioClient(`http://127.0.0.1:${testPort}`, { reconnection: false });

  await new Promise<void>((resolve) => {
    let connected = 0;
    const check = () => {
      connected++;
      if (connected === 2) resolve();
    };
    clientA.on('connect', check);
    clientB.on('connect', check);
  });

  try {
    // ── TEST 1: Initial Alarm Trigger on Ingestion ──
    console.log('--- TEST 1: Initial Alarm Trigger on Ingestion ---');
    let clientAReceivedAlarmTrigger = false;
    let clientBReceivedAlarmTrigger = false;

    clientA.on('officer:alert', (data) => {
      if (data.trip.tripId === 'trip-alarm-01' && data.alarmTrigger) {
        clientAReceivedAlarmTrigger = true;
      }
    });

    clientB.on('officer:alert', (data) => {
      if (data.trip.tripId === 'trip-alarm-01' && data.alarmTrigger) {
        clientBReceivedAlarmTrigger = true;
      }
    });

    const dispatchRes = await request('POST', '/api/v1/emergency-dispatch', authHeaders, {
      tripId: 'trip-alarm-01',
      vehicleId: 'amb-alarm-01',
      priority: 'CRITICAL',
      origin: { lat: 9.8965, lng: 76.718 },
      destination: { lat: 9.967, lng: 76.319 },
      originName: 'Thodupuzha Hub',
      destinationName: 'Vyttila Medical Center',
    });

    assert(dispatchRes.status === 200, 'Emergency dispatch ingested successfully');
    assert(dispatchRes.body.alarmTriggered === true, 'Server signals alarmTriggered: true for new alert');

    // Wait for socket broadcast
    await new Promise((r) => setTimeout(r, 200));
    assert(clientAReceivedAlarmTrigger, 'Dashboard A received alarmTrigger: true');
    assert(clientBReceivedAlarmTrigger, 'Dashboard B received alarmTrigger: true');

    const tripInState = officerState.getTrip('trip-alarm-01');
    assert(!!tripInState, 'Trip exists in state');
    assert(tripInState!.acknowledged === false, 'Trip initial acknowledged status is false');

    // ── TEST 2: Network-Synchronized Acknowledge & Alarm Stop ──
    console.log('\n--- TEST 2: Network-Synchronized Acknowledge & Alarm Stop ---');
    let clientBReceivedAck = false;
    let acknowledgedPayload: any = null;

    clientB.on('trip:acknowledged', (data) => {
      clientBReceivedAck = true;
      acknowledgedPayload = data;
    });

    // Client A registers officer and acknowledges
    clientA.emit('officer:register', {
      officerId: 'off-kl-4055',
      badgeNumber: 'KP-TR-4055',
      name: 'SI Vinod Kumar',
      station: 'Muvattupuzha Traffic Unit',
    });
    await new Promise((r) => setTimeout(r, 100));

    clientA.emit('trip:acknowledge', {
      tripId: 'trip-alarm-01',
      officerId: 'off-kl-4055',
      officerName: 'SI Vinod Kumar',
    });

    await new Promise((r) => setTimeout(r, 200));

    assert(clientBReceivedAck, 'Dashboard B received trip:acknowledged broadcast from Dashboard A action');
    assert(acknowledgedPayload?.tripId === 'trip-alarm-01', 'Broadcast includes correct tripId');
    assert(acknowledgedPayload?.acknowledgedBy === 'SI Vinod Kumar', 'Broadcast includes acknowledging officer name');

    const updatedTrip = officerState.getTrip('trip-alarm-01');
    assert(updatedTrip?.acknowledged === true, 'Server state updated: trip.acknowledged is true');
    assert(updatedTrip?.acknowledgedBy === 'SI Vinod Kumar', 'Server state updated: trip.acknowledgedBy recorded');
    assert(typeof updatedTrip?.acknowledgedAt === 'number', 'Server state updated: trip.acknowledgedAt recorded');
    assert(updatedTrip?.status === 'ACTIVE', 'Safety Invariant: Emergency remains ACTIVE; stopping sound did NOT cancel emergency');

    // Verify Audit Trail
    const logs = officerState.getAuditLogs('trip-alarm-01');
    const ackLog = logs.find((l) => l.action === 'TRIP_ALERT_ACKNOWLEDGED');
    assert(!!ackLog, 'Audit log trail contains TRIP_ALERT_ACKNOWLEDGED entry');
    assert(ackLog?.actorName === 'SI Vinod Kumar', 'Audit log records officer identity');

    // ── TEST 3: Duplicate Events & Reconnects Do NOT Restart Acknowledged Alarm ──
    console.log('\n--- TEST 3: Duplicate Events & Reconnects Do NOT Restart Alarm ---');
    let clientARestartedAlarm = false;

    clientA.on('officer:alert', (data) => {
      if (data.trip.tripId === 'trip-alarm-01' && data.alarmTrigger) {
        clientARestartedAlarm = true;
      }
    });

    // Re-send dispatch packet for acknowledged trip
    const repeatDispatch = await request('POST', '/api/v1/emergency-dispatch', authHeaders, {
      tripId: 'trip-alarm-01',
      vehicleId: 'amb-alarm-01',
      priority: 'CRITICAL',
      origin: { lat: 9.8965, lng: 76.718 },
      destination: { lat: 9.967, lng: 76.319 },
    });

    assert(repeatDispatch.status === 200, 'Repeat dispatch accepted');
    assert(repeatDispatch.body.alarmTriggered === false, 'Server suppressed alarmTriggered for acknowledged trip');

    // New client socket reconnect
    const clientC: Socket = ioClient(`http://127.0.0.1:${testPort}`, { reconnection: false });
    let clientCAlarmTrigger = false;
    let clientCTripAcknowledgedState = false;

    clientC.on('officer:alert', (data) => {
      if (data.trip.tripId === 'trip-alarm-01') {
        clientCAlarmTrigger = data.alarmTrigger;
        clientCTripAcknowledgedState = !!data.trip.acknowledged;
      }
    });

    await new Promise((r) => setTimeout(r, 200));
    assert(!clientARestartedAlarm, 'Client A alarm was NOT restarted by repeat dispatch');
    assert(!clientCAlarmTrigger, 'Reconnected Client C received alarmTrigger: false');
    assert(clientCTripAcknowledgedState, 'Reconnected Client C received trip with acknowledged: true');
    clientC.disconnect();

    // ── TEST 4: Multiple Simultaneous Alerts Tracked Independently ──
    console.log('\n--- TEST 4: Multiple Simultaneous Alerts Independent Tracking ---');
    // Ingest Trip 02 while Trip 01 is acknowledged
    const trip2Res = await request('POST', '/api/v1/emergency-dispatch', authHeaders, {
      tripId: 'trip-alarm-02',
      vehicleId: 'amb-alarm-02',
      priority: 'CRITICAL',
      origin: { lat: 9.98, lng: 76.57 },
      destination: { lat: 10.10, lng: 76.35 },
      originName: 'Muvattupuzha GH',
      destinationName: 'Aluva District Hospital',
    });

    assert(trip2Res.body.alarmTriggered === true, 'New Trip 02 triggers alarm independently');
    const trip1State = officerState.getTrip('trip-alarm-01');
    const trip2State = officerState.getTrip('trip-alarm-02');
    assert(trip1State?.acknowledged === true, 'Trip 01 remains acknowledged');
    assert(trip2State?.acknowledged === false, 'Trip 02 remains unacknowledged');

    // Acknowledge Trip 02 via REST endpoint
    const restAckRes = await request('POST', '/api/v1/trips/trip-alarm-02/acknowledge', {}, {
      officerId: 'off-kl-rest',
      officerName: 'Inspector Rajesh',
    });
    assert(restAckRes.status === 200, 'REST acknowledge endpoint returns HTTP 200');
    assert(restAckRes.body.acknowledged === true, 'REST acknowledge confirms acknowledged: true');
    assert(officerState.getTrip('trip-alarm-02')?.acknowledged === true, 'Trip 02 state marked acknowledged');

    // ── TEST 5: Cancellation & Completion Lifecycle ──
    console.log('\n--- TEST 5: Emergency Cancellation & Completion Lifecycle ---');
    // End trip through state manager
    officerState.endTrip('trip-alarm-01', 'COMPLETED');
    const endedTrip = officerState.getTrip('trip-alarm-01');
    assert(endedTrip?.status === 'COMPLETED', 'Trip status transitioned to COMPLETED');
    assert(endedTrip?.acknowledged === true, 'Trip acknowledgement history retained');
    assert(endedTrip?.junctions.length! > 0, 'Junction tasks preserved intact');

    console.log('\n════════════════════════════════════════════════════════════════');
    console.log('SUMMARY: ALL ALARM LIFECYCLE TESTS PASSED CLEANLY! (100% OK)');
    console.log('════════════════════════════════════════════════════════════════\n');
  } finally {
    clientA.disconnect();
    clientB.disconnect();
    testServer.close();
  }
}

runAlarmLifecycleTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
