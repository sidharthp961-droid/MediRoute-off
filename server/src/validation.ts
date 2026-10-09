// ══════════════════════════════════════════════════════════════
// MediRoute Officer Alert Server — Input Validation
// ══════════════════════════════════════════════════════════════

import { Coordinates, JunctionClearanceStatus, TripPriority } from './types';

export function isValidCoordinates(coords: unknown): coords is Coordinates {
  if (!coords || typeof coords !== 'object') return false;
  const c = coords as Partial<Coordinates>;
  return (
    typeof c.lat === 'number' &&
    typeof c.lng === 'number' &&
    !isNaN(c.lat) &&
    !isNaN(c.lng) &&
    c.lat >= -90 &&
    c.lat <= 90 &&
    c.lng >= -180 &&
    c.lng <= 180
  );
}

export const VALID_CLEARANCE_STATUSES: JunctionClearanceStatus[] = [
  'PENDING',
  'ASSIGNED',
  'CLEARING',
  'CLEARED',
];

export const VALID_PRIORITIES: TripPriority[] = ['CRITICAL', 'URGENT', 'ROUTINE'];

export function isValidClearanceStatus(status: unknown): status is JunctionClearanceStatus {
  return typeof status === 'string' && VALID_CLEARANCE_STATUSES.includes(status as JunctionClearanceStatus);
}

export function validateDispatchPayload(data: any): { valid: boolean; error?: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Dispatch payload must be a JSON object' };
  }

  if (!data.tripId || typeof data.tripId !== 'string') {
    return { valid: false, error: 'tripId is required and must be a string' };
  }

  if (!data.vehicleId || typeof data.vehicleId !== 'string') {
    return { valid: false, error: 'vehicleId is required and must be a string' };
  }

  if (!isValidCoordinates(data.origin)) {
    return { valid: false, error: 'Valid origin coordinates are required' };
  }

  if (!isValidCoordinates(data.destination)) {
    return { valid: false, error: 'Valid destination coordinates are required' };
  }

  if (data.priority && !VALID_PRIORITIES.includes(data.priority)) {
    return { valid: false, error: `priority must be one of: ${VALID_PRIORITIES.join(', ')}` };
  }

  return { valid: true };
}
