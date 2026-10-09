// ══════════════════════════════════════════════════════════════
// MediRoute Officer Alert Server — Kerala Corridor Junction Engine
// ══════════════════════════════════════════════════════════════

import { Coordinates, JunctionTask } from './types';
import { v4 as uuid } from 'uuid';

export interface PresetJunction {
  name: string;
  landmark: string;
  location: Coordinates;
  station: string;
}

export const KERALA_PRESET_JUNCTIONS: PresetJunction[] = [
  {
    name: 'Thodupuzha Gandhi Square Junction',
    landmark: 'Thodupuzha Town Centre / KSRTC Depot',
    location: { lat: 9.8965, lng: 76.718 },
    station: 'Thodupuzha Traffic Police Unit',
  },
  {
    name: 'Vengalloor Bypass Junction',
    landmark: 'SH 8 Vengalloor Bridge Entrance',
    location: { lat: 9.9142, lng: 76.697 },
    station: 'Thodupuzha Traffic Police Unit',
  },
  {
    name: 'Vazhakulam Town Junction',
    landmark: 'Pineapple Market Square (SH 8)',
    location: { lat: 9.948, lng: 76.643 },
    station: 'Vazhakulam Police Station',
  },
  {
    name: 'Muvattupuzha Post Office Junction',
    landmark: 'SH 8 & MC Road Intersection / Nehru Park',
    location: { lat: 9.983, lng: 76.578 },
    station: 'Muvattupuzha Traffic Enforcement Unit',
  },
  {
    name: 'Kolenchery Junction',
    landmark: 'MOSC Medical College Gate (SH 41)',
    location: { lat: 9.981, lng: 76.471 },
    station: 'Puthencruz Police Station',
  },
  {
    name: 'Thrippunithura Statue Junction',
    landmark: 'Statue Square / Hill Palace Road Link',
    location: { lat: 9.953, lng: 76.352 },
    station: 'Thrippunithura Traffic Station',
  },
  {
    name: 'Vyttila Mobility Hub Junction',
    landmark: 'NH 66 Bypass & SA Road Intersection',
    location: { lat: 9.967, lng: 76.319 },
    station: 'Kochi City Traffic West Unit',
  },
  {
    name: 'Medical Trust Junction (Kadavanthra - MG Road)',
    landmark: 'SA Road / Manorama Jn Approach',
    location: { lat: 9.962, lng: 76.294 },
    station: 'Ernakulam City Traffic Central',
  },
];

export function haversineDistance(c1: Coordinates, c2: Coordinates): number {
  const R = 6371e3; // Earth radius in metres
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(c2.lat - c1.lat);
  const dLng = toRad(c2.lng - c1.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(c1.lat)) *
      Math.cos(toRad(c2.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Builds sequence of JunctionTasks for a given trip based on origin, destination,
 * and route corridor.
 */
export function buildJunctionTasksForTrip(
  tripId: string,
  ambulanceLoc: Coordinates,
  routeCoordinates?: [number, number][],
): JunctionTask[] {
  // If route coordinates are supplied, check which preset junctions are near the route (< 2.5 km)
  let relevantPresets = KERALA_PRESET_JUNCTIONS;

  if (routeCoordinates && routeCoordinates.length > 0) {
    relevantPresets = KERALA_PRESET_JUNCTIONS.filter((pj) => {
      // Find minimum distance from any route node
      return routeCoordinates.some((coord) => {
        const dist = haversineDistance(pj.location, { lat: coord[0], lng: coord[1] });
        return dist <= 2500; // Within 2.5 km of route line
      });
    });

    // If none matched, fallback to all presets so the police interface always has coordination points
    if (relevantPresets.length === 0) {
      relevantPresets = KERALA_PRESET_JUNCTIONS;
    }
  }

  const now = Date.now();
  return relevantPresets.map((pj, idx) => {
    const dist = haversineDistance(ambulanceLoc, pj.location);
    // Estimated travel time assuming avg 40 km/h in emergency clearance
    const etaSec = Math.round((dist / (40 * (1000 / 3600))));

    return {
      id: `jnc-${uuid().slice(0, 8)}`,
      tripId,
      name: pj.name,
      landmark: pj.landmark,
      location: pj.location,
      sequenceOrder: idx + 1,
      status: 'PENDING',
      assignedOfficerStation: pj.station,
      distanceFromAmbulanceMetres: Math.round(dist),
      etaSeconds: etaSec,
      lastUpdatedAt: now,
    };
  });
}

/**
 * Recalculates distance and ETA for all junction tasks given new ambulance location.
 */
export function updateJunctionDistances(
  junctions: JunctionTask[],
  currentLoc: Coordinates,
): JunctionTask[] {
  return junctions.map((j) => {
    const dist = haversineDistance(currentLoc, j.location);
    const etaSec = Math.round(dist / (40 * (1000 / 3600)));
    return {
      ...j,
      distanceFromAmbulanceMetres: Math.round(dist),
      etaSeconds: etaSec,
    };
  });
}
