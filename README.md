# MediRoute — Officer Alert Server & Traffic Clearance System

MediRoute is a smart emergency vehicle communication platform that helps private vehicles transporting patients alert nearby road users through real-time location tracking, proximity-based notifications, hospital routing, and emergency coordination.

> **Kerala Police Emergency Corridor Clearance & Officer Alert Console**  
> Hackathon System Extension for MediRoute

---

## 1. Overview & Architecture

This is a dedicated, separate **Officer Alert Server** and **Officer Dashboard** created to coordinate police clearance along emergency ambulance routes without modifying or interrupting the primary MediRoute Core Server.

```
┌─────────────────────────────────┐           ┌──────────────────────────────────────┐
│   MediRoute Core Server (3001)  │◄─────────►│  Officer Alert Server (Port 3002)    │
│  - 1 km Driver Geofence Alerts  │           │  - Core Server Bridge (Socket.IO)    │
│  - Incident Reports & Moderation│           │  - Dedicated Express + Socket.IO     │
│  - Emergency Corridor Engine    │           │  - Junction Clearance State Machine  │
└────────────────┬────────────────┘           │  - Duplicate Siren Deduplication     │
                 │                            │  - Immutable Audit Log Trail         │
                 ▼                            └──────────────────┬───────────────────┘
┌─────────────────────────────────┐                              │
│   MediRoute Web Client (5173)   │                              ▼
│   & Laptop 2 Android Auto       │           ┌──────────────────────────────────────┐
│  - Normal Driver HUD & Alerts   │           │    Officer Dashboard / PWA (5174)    │
│  - Command Centre Ambulance UI  │           │  - Police Map with Ambulance & Route │
└─────────────────────────────────┘           │  - Junction Status (Pending->Cleared)│
                                              │  - Dual-Tone Audible Web Audio Siren │
                                              │  - Mute & Test Alarm Controls        │
                                              │  - Kerala Police Officer Roster      │
                                              └──────────────────────────────────────┘
```

---

## 2. Key Port Allocations & Environment

| Service | Port | Directory | Description |
| :--- | :--- | :--- | :--- |
| **MediRoute Core Server** | `3001` | `D:\MediRoute\server` | Primary server (Driver alerts, reports, ambulance state) |
| **MediRoute Client** | `5173` | `D:\MediRoute\client` | Command Centre & Laptop 2 Android Auto car setup |
| **Officer Alert Server** | `3002` | `d:\medirouteoff\server` | Dedicated officer dispatch, deduplication & junction engine |
| **Officer Dashboard (PWA)**| `5174` | `d:\medirouteoff\client` | Police console & mobile PWA dashboard |

---

## 3. Quick Start (Running Both Server & UI)

### Step 1: Install Dependencies
```bash
# In d:\medirouteoff
npm run install:all
```

### Step 2: Run Officer Server and Dashboard Concurrently
```bash
npm run dev
```
- **Officer Server**: Runs at `http://localhost:3002`
- **Officer Dashboard**: Runs at `http://localhost:5174` (Accessible via LAN at `http://<LAN_IP>:5174`)

### Step 3: Run Automated Test Suites
```bash
# Run Officer Alert Server audit tests (Diagnostics, Auth, Deduplication, Junctions, Audit logs)
npm run test:server

# Run End-to-End Core Server Bridge integration test
cd server && npx tsx test/integration-core.test.ts
```

---

## 4. Phone Experience Investigation: PWA vs. APK

| Aspect | Progressive Web App (PWA) — *Implemented* | Native APK (Android Package) |
| :--- | :--- | :--- |
| **Setup Time** | **Instant (0 minutes build time)**. Works on any smartphone browser. | 1.5 - 2 hours build setup (Android Studio, SDK, Gradle, Capacitor/TWA). |
| **Distribution** | Connect phone to host Wi-Fi/Hotspot, open `http://<IP>:5174`. | Transfer `.apk` file via USB/Drive and enable "Install from Unknown Sources". |
| **Installability** | Tap **"Add to Home Screen"**; runs standalone without browser chrome. | Standard Android app launcher icon. |
| **Audio Siren** | Dual-tone synthesized Web Audio API alarm runs reliably in active screen. | Can use Android Foreground Service for locked-screen audio. |
| **Hackathon Recommendation** | **PWA is the optimal choice for a 10-hour hackathon.** Demonstrates full UI, interactive clearance, and instant multi-device deployment. | Requires heavy native toolchains and does not add presentation value over PWA. |

> **Transparency Note**: Background alerts while the phone screen is locked require native Android Foreground Services (`WAKE_LOCK`, `FOREGROUND_SERVICE`). In our PWA implementation, the dashboard is designed to run in an active/foreground mobile browser tab mounted on a police bike or dashboard.

---

## 5. Junction Clearance State Machine

Officers along the route coordinate green corridor clearance using four verified states:
1. **PENDING** (🟡): Corridor active; checkpoint needs officer assignment.
2. **ASSIGNED** (🔵): Officer acknowledges alert and moves to junction post.
3. **CLEARING** (🟠): Officer actively halting cross-traffic and pedestrian crossings.
4. **CLEARED** (🟢): Green corridor confirmed clear! Ambulance has priority right-of-way.

### Pre-mapped Kerala Highway Corridors:
- **Thodupuzha Gandhi Square Junction** (SH 8)
- **Vengalloor Bypass Junction** (SH 8)
- **Vazhakulam Pineapple Market Junction** (SH 8)
- **Muvattupuzha Post Office / Nehru Park Junction** (SH 8 & MC Road)
- **Kolenchery MOSC Medical College Junction** (SH 41)
- **Thrippunithura Statue Junction** (SH 41)
- **Vyttila Mobility Hub & Bypass Junction** (NH 66)
- **Ernakulam Medical Trust / SA Road Junction**

---

## 6. What Actually Works vs. What Is Simulated

### ✅ Actually Implemented & Working:
- Separate backend service running independently on port `3002`.
- Real-time Socket.IO bridge to MediRoute Core Server (`http://localhost:3001`).
- Independent operation: Driver 1 km alerts on Core Server keep working even if Officer Server restarts or goes offline.
- Laptop 2 Android Auto / car-side setup remains completely untouched and functional.
- Web Audio API dual-tone siren alarm with **Test Alarm** and **Silence & Mute** controls.
- SHA-256 signature deduplication preventing repeated siren alarms for the same emergency.
- Real-time interactive junction table with one-click status transitions.
- Immutable audit log recording every dispatch and clearance status change.
- PWA manifest (`manifest.json`) and service worker (`sw.js`).
- Automated test suites (all passing 100%).

### ⚠️ Simulated for Hackathon Demo:
- **GPS Coordinates & Telemetry**: Uses simulated road movements along Kerala highways.
- **Traffic Signal Control**: Simulated coordination via officer manual clearance (does not override municipal traffic light controllers).
- **Police Radio Networks**: Operates via WebSocket LAN connection, not encrypted police TETRA/APCO-25 wireless channels.
