// ══════════════════════════════════════════════════════════════
// MediRoute Officer Alert Server — Duplicate Alert Suppression
// ══════════════════════════════════════════════════════════════

import crypto from 'crypto';

export class AlertDeduplicator {
  private seenSignatures: Map<string, number> = new Map();
  private alarmTriggeredTrips: Set<string> = new Set();
  private readonly ttlMs: number;

  constructor(ttlSeconds = 120) {
    this.ttlMs = ttlSeconds * 1000;
  }

  /**
   * Generates a deterministic hash for an incoming dispatch event payload.
   */
  createSignature(tripId: string, vehicleId: string, timestampWindowMs = 15_000): string {
    // Quantize timestamp to 15s window to coalesce rapid re-transmissions
    const quantizedTime = Math.floor(Date.now() / timestampWindowMs);
    const raw = `${tripId}:${vehicleId}:${quantizedTime}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Checks if this dispatch signature has already been received recently.
   * If not seen, records it and returns false. If seen, returns true.
   */
  isDuplicateEvent(signature: string): boolean {
    this.cleanup();
    const existing = this.seenSignatures.get(signature);
    if (existing && Date.now() - existing < this.ttlMs) {
      return true;
    }
    this.seenSignatures.set(signature, Date.now());
    return false;
  }

  /**
   * Determines if the audible alarm should be fired for this trip.
   * Audible alarm should only fire ONCE per unique emergency trip
   * until explicitly reset or completed.
   */
  shouldTriggerAudibleAlarm(tripId: string): boolean {
    if (this.alarmTriggeredTrips.has(tripId)) {
      return false; // Already triggered for this trip; prevent repeat siren
    }
    this.alarmTriggeredTrips.add(tripId);
    return true;
  }

  /**
   * Manually resets alarm trigger state for a trip (e.g. if new escalation occurs).
   */
  resetTripAlarm(tripId: string): void {
    this.alarmTriggeredTrips.delete(tripId);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [sig, time] of this.seenSignatures.entries()) {
      if (now - time > this.ttlMs) {
        this.seenSignatures.delete(sig);
      }
    }
  }
}

export const alertDeduplicator = new AlertDeduplicator(180);
