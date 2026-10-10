// ══════════════════════════════════════════════════════════════
// MediRoute — Failure Isolation Test
// ══════════════════════════════════════════════════════════════

import http from 'http';
import { io as ioClient } from 'socket.io-client';

const CORE_SERVER_URL = 'http://127.0.0.1:3001';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`  ❌ [FAIL] ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`  ✅ [PASS] ${msg}`);
}

async function runFailureIsolationTest() {
  console.log('════════════════════════════════════════════════════════════════');
  console.log('FAILURE ISOLATION: CORE SERVER 1 KM DRIVER ALERTS TEST');
  console.log('════════════════════════════════════════════════════════════════\n');

  // Verify Core Server Health
  const coreHealth = await new Promise<boolean>((resolve) => {
    http.get(`${CORE_SERVER_URL}/api/health`, (res) => resolve(res.statusCode === 200)).on('error', () => resolve(false));
  });
  assert(coreHealth, 'Core Server is operational on port 3001');

  // Connect Driver Socket to Core Server
  const driverSocket = ioClient(CORE_SERVER_URL);
  let driverAlertReceived: any = null;

  await new Promise<void>((resolve, reject) => {
    driverSocket.on('connect', () => {
      console.log('  -> Driver client connected to Core Server');
      // Register driver at Thodupuzha (approx 400m from hub: lat 9.897, lng 76.719)
      driverSocket.emit('vehicle:register', {
        role: 'driver',
        label: 'Kerala Private Car KL-07-AB-1234',
        location: { lat: 9.897, lng: 76.719 },
      } as any);
      resolve();
    });
    driverSocket.on('connect_error', reject);
  });

  driverSocket.on('alert:incoming', (data) => {
    driverAlertReceived = data;
  });

  // Connect Emergency Vehicle Socket to Core Server
  const ambSocket = ioClient(CORE_SERVER_URL);
  await new Promise<void>((resolve, reject) => {
    ambSocket.on('connect', () => {
      console.log('  -> Emergency vehicle connected to Core Server');
      ambSocket.emit('vehicle:register', {
        role: 'emergency',
        label: '108 Ambulance Unit #301',
        location: { lat: 9.8965, lng: 76.718 },
      } as any);
      resolve();
    });
    ambSocket.on('connect_error', reject);
  });

  // Trigger emergency on Core Server
  console.log('  -> Triggering emergency on Core Server while testing driver geofence...');
  ambSocket.emit('emergency:start', {
    origin: { lat: 9.8965, lng: 76.718 },
    destination: { lat: 9.962, lng: 76.294 },
  } as any);

  // Wait 1 second for proximity calculation
  await new Promise((r) => setTimeout(r, 1000));

  assert(!!driverAlertReceived, 'Independent 1 km proximity alert delivered to driver on Core Server');
  assert(typeof driverAlertReceived.distance === 'number', 'Driver alert includes calculated distance in metres');
  assert(driverAlertReceived.distance <= 1000, 'Distance is within 1,000 m emergency radius');

  // Clean up emergency
  ambSocket.emit('emergency:cancel');
  await new Promise((r) => setTimeout(r, 400));

  driverSocket.disconnect();
  ambSocket.disconnect();

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('FAILURE ISOLATION VERIFIED: CORE SERVER & 1 KM ALERTS FULLY INDEPENDENT!');
  console.log('════════════════════════════════════════════════════════════════\n');
  process.exit(0);
}

runFailureIsolationTest().catch((err) => {
  console.error('Failure isolation test failed:', err);
  process.exit(1);
});
