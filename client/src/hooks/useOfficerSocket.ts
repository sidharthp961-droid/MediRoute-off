import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  EmergencyTrip,
  JunctionTask,
  JunctionClearanceStatus,
  OfficerUser,
  AuditLogEntry,
} from '../types';

const DEFAULT_OFFICER: OfficerUser = {
  id: 'off-kl-02',
  badgeNumber: 'KP-TR-4055',
  name: 'SI Vinod Kumar',
  station: 'Muvattupuzha Traffic Enforcement Unit',
  role: 'officer',
};

export function useOfficerSocket(
  onAlarmTrigger?: (tripId: string) => void,
  onAlarmStop?: (tripId?: string) => void,
) {
  const [connected, setConnected] = useState(false);
  const [activeTrip, setActiveTrip] = useState<EmergencyTrip | null>(null);
  const [junctions, setJunctions] = useState<JunctionTask[]>([]);
  const [acknowledgedTripIds, setAcknowledgedTripIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('mediroute_acknowledged_trips');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [officer, setOfficerState] = useState<OfficerUser>(() => {
    try {
      const saved = localStorage.getItem('mediroute_officer_user');
      return saved ? JSON.parse(saved) : DEFAULT_OFFICER;
    } catch {
      return DEFAULT_OFFICER;
    }
  });

  const [bridgeStatus, setBridgeStatus] = useState({
    connectedToCore: false,
    coreUrl: 'http://localhost:3001',
  });
  const [lastAlertMessage, setLastAlertMessage] = useState<string | null>(null);
  const [auditLogs] = useState<AuditLogEntry[]>([]);

  const socketRef = useRef<Socket | null>(null);
  const onAlarmTriggerRef = useRef(onAlarmTrigger);
  onAlarmTriggerRef.current = onAlarmTrigger;
  const onAlarmStopRef = useRef(onAlarmStop);
  onAlarmStopRef.current = onAlarmStop;

  // Determine server URL dynamically: same host, port 3002
  const getServerUrl = () => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname || 'localhost';
      return `http://${hostname}:3002`;
    }
    return 'http://localhost:3002';
  };

  useEffect(() => {
    const serverUrl = getServerUrl();
    console.log(`[OfficerSocket] Connecting to ${serverUrl}...`);

    const socket = io(serverUrl, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      console.log('✅ [OfficerSocket] Connected to Officer Alert Server');

      // Register currently active officer
      socket.emit('officer:register', {
        officerId: officer.id,
        badgeNumber: officer.badgeNumber,
        name: officer.name,
        station: officer.station,
      });
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('officer:alert', (data: any) => {
      console.log('🚨 [OfficerSocket] Alert received:', data);
      if (data?.trip) {
        setAcknowledgedTripIds((prev) => {
          const isAlreadyAck = data.trip.acknowledged || prev.has(data.trip.tripId);
          const mergedTrip: EmergencyTrip = {
            ...data.trip,
            acknowledged: isAlreadyAck,
            acknowledgedBy: data.trip.acknowledgedBy || (isAlreadyAck ? 'Officer' : undefined),
          };
          setActiveTrip(mergedTrip);
          setJunctions(data.trip.junctions || []);

          if (data?.alarmTrigger && !isAlreadyAck) {
            onAlarmTriggerRef.current?.(data.trip.tripId);
          } else if (isAlreadyAck) {
            onAlarmStopRef.current?.(data.trip.tripId);
          }
          return prev;
        });
      }
      if (data?.alertMessage) {
        setLastAlertMessage(data.alertMessage);
      }
    });

    socket.on('trip:acknowledged', (data: { tripId: string; acknowledgedBy: string; acknowledgedAt: number }) => {
      console.log('🛡️ [OfficerSocket] Trip acknowledged broadcast received:', data);
      setAcknowledgedTripIds((prev) => {
        const updated = new Set(prev);
        updated.add(data.tripId);
        try {
          localStorage.setItem('mediroute_acknowledged_trips', JSON.stringify(Array.from(updated)));
        } catch {}
        return updated;
      });

      setActiveTrip((prev) =>
        prev && prev.tripId === data.tripId
          ? {
              ...prev,
              acknowledged: true,
              acknowledgedBy: data.acknowledgedBy,
              acknowledgedAt: data.acknowledgedAt,
            }
          : prev,
      );

      // Stop alarm immediately upon synchronized network acknowledgement
      onAlarmStopRef.current?.(data.tripId);
      setLastAlertMessage(`Corridor ${data.tripId} acknowledged by ${data.acknowledgedBy}`);
    });

    socket.on('trip:location-update', (data: any) => {
      if (data?.currentLocation) {
        setActiveTrip((prev) =>
          prev
            ? {
                ...prev,
                currentLocation: data.currentLocation,
                totalDistanceKm: data.distanceRemainingKm || prev.totalDistanceKm,
                etaMinutes: data.etaMinutes !== undefined ? data.etaMinutes : prev.etaMinutes,
                junctions: data.junctions || prev.junctions,
              }
            : null,
        );
      }
      if (data?.junctions) {
        setJunctions(data.junctions);
      }
    });

    socket.on('trip:status-update', (data: any) => {
      setActiveTrip((prev) => (prev && prev.tripId === data.tripId ? { ...prev, status: data.status } : prev));
      if (data.status === 'COMPLETED' || data.status === 'CANCELLED') {
        // Lifecycle rule: stop alarm when emergency is completed or cancelled
        onAlarmStopRef.current?.(data.tripId);
        setLastAlertMessage(`Emergency corridor ${data.status.toLowerCase()}`);
      }
    });

    socket.on('junction:status-changed', (data: any) => {
      if (data?.junction) {
        setJunctions((prev) =>
          prev.map((j) => (j.id === data.junction.id ? data.junction : j)),
        );
        setActiveTrip((prev) =>
          prev
            ? {
                ...prev,
                junctions: prev.junctions.map((j) =>
                  j.id === data.junction.id ? data.junction : j,
                ),
              }
            : null,
        );
      }
    });

    socket.on('core-bridge:status', (data: any) => {
      setBridgeStatus({
        connectedToCore: !!data.connectedToCore,
        coreUrl: data.coreUrl || 'http://localhost:3001',
      });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const updateJunctionStatus = useCallback(
    (junctionId: string, status: JunctionClearanceStatus, notes?: string) => {
      if (!activeTrip || !socketRef.current) return;

      socketRef.current.emit('junction:update-status', {
        tripId: activeTrip.tripId,
        junctionId,
        status,
        officerId: officer.id,
        officerName: officer.name,
        notes,
      });
    },
    [activeTrip, officer],
  );

  const setOfficer = useCallback((newOfficer: OfficerUser) => {
    setOfficerState(newOfficer);
    try {
      localStorage.setItem('mediroute_officer_user', JSON.stringify(newOfficer));
    } catch {
      // ignore
    }
    if (socketRef.current?.connected) {
      socketRef.current.emit('officer:register', {
        officerId: newOfficer.id,
        badgeNumber: newOfficer.badgeNumber,
        name: newOfficer.name,
        station: newOfficer.station,
      });
    }
  }, []);

  const acknowledgeTrip = useCallback((targetTripId?: string) => {
    const tripToAck = targetTripId || activeTrip?.tripId;
    if (!tripToAck) return;

    // 1. Stop local audio alarm immediately
    onAlarmStopRef.current?.(tripToAck);

    // 2. Optimistically mark acknowledged in local set and state
    setAcknowledgedTripIds((prev) => {
      const updated = new Set(prev);
      updated.add(tripToAck);
      try {
        localStorage.setItem('mediroute_acknowledged_trips', JSON.stringify(Array.from(updated)));
      } catch {}
      return updated;
    });

    setActiveTrip((prev) =>
      prev && prev.tripId === tripToAck
        ? {
            ...prev,
            acknowledged: true,
            acknowledgedBy: officer.name,
            acknowledgedAt: Date.now(),
          }
        : prev,
    );

    // 3. Emit acknowledgement to server to broadcast to all dashboards and write audit log
    if (socketRef.current?.connected) {
      socketRef.current.emit('trip:acknowledge', {
        tripId: tripToAck,
        officerId: officer.id,
        officerName: officer.name,
      });
    }
  }, [activeTrip?.tripId, officer.id, officer.name]);

  const isTripAcknowledged = useCallback(
    (tripId: string) =>
      acknowledgedTripIds.has(tripId) || (activeTrip?.tripId === tripId && !!activeTrip?.acknowledged),
    [acknowledgedTripIds, activeTrip],
  );

  // Demo dispatch trigger for evaluation / offline presentation
  const triggerDemoTrip = useCallback(async () => {
    const serverUrl = getServerUrl();
    const demoPayload = {
      tripId: `demo-trip-${Date.now().toString().slice(-4)}`,
      vehicleId: 'KL-07-EM-9999',
      priority: 'CRITICAL',
      patientCondition: 'Acute Myocardial Infarction (Cardiac Golden Hour)',
      origin: { lat: 9.8965, lng: 76.718 }, // Thodupuzha
      destination: { lat: 9.962, lng: 76.294 }, // Ernakulam Medical Trust
      originName: 'District Hospital Thodupuzha Hub',
      destinationName: 'Ernakulam Medical Trust Hospital',
      totalDistanceKm: '58.2 km',
      etaMinutes: 44,
      isSimulated: true,
    };

    try {
      const res = await fetch(`${serverUrl}/api/v1/emergency-dispatch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-officer-service-token': 'mr-officer-bridge-secure-key-2026',
        },
        body: JSON.stringify(demoPayload),
      });
      return await res.json();
    } catch (err) {
      console.error('[OfficerSocket] Demo dispatch failed:', err);
    }
  }, []);

  return {
    connected,
    activeTrip,
    junctions,
    officer,
    setOfficer,
    bridgeStatus,
    lastAlertMessage,
    acknowledgedTripIds,
    isTripAcknowledged,
    updateJunctionStatus,
    acknowledgeTrip,
    triggerDemoTrip,
    auditLogs,
  };
}
