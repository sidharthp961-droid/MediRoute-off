// ══════════════════════════════════════════════════════════════
// MediRoute Officer Alert Server — Authentication & Security
// ══════════════════════════════════════════════════════════════

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { OfficerUser } from './types';

// In-memory active officer sessions
export const activeOfficers = new Map<string, OfficerUser>();

// Mock authorized officer roster for Kerala Traffic Enforcement
export const REGISTERED_OFFICERS: OfficerUser[] = [
  {
    id: 'off-kl-01',
    badgeNumber: 'KP-TR-4012',
    name: 'Insp. Radhakrishnan Nair',
    station: 'Thodupuzha Traffic Police Unit',
    role: 'supervisor',
  },
  {
    id: 'off-kl-02',
    badgeNumber: 'KP-TR-4055',
    name: 'SI Vinod Kumar',
    station: 'Muvattupuzha Traffic Enforcement Unit',
    role: 'officer',
  },
  {
    id: 'off-kl-03',
    badgeNumber: 'KP-TR-5120',
    name: 'SCPO Priya Sasi',
    station: 'Thrippunithura Traffic Station',
    role: 'officer',
  },
  {
    id: 'off-kl-04',
    badgeNumber: 'KP-TR-6299',
    name: 'CPO Mathew Varghese',
    station: 'Kochi City Traffic West Unit (Vyttila)',
    role: 'officer',
  },
  {
    id: 'off-kl-05',
    badgeNumber: 'KP-TR-7001',
    name: 'CPO Anoop Das',
    station: 'Ernakulam City Traffic Central',
    role: 'officer',
  },
];

export function getServiceToken(): string {
  return process.env.OFFICER_SERVICE_TOKEN || 'mr-officer-bridge-secure-key-2026';
}

export function getAdminKey(): string {
  return process.env.OFFICER_ADMIN_KEY || 'officer-admin-key-kerala-police-demo';
}

/**
 * Middleware ensuring request originated from authorized MediRoute Core Server.
 */
export function requireServerAuthentication(req: Request, res: Response, next: NextFunction) {
  const token =
    (req.headers['x-officer-service-token'] as string) ||
    (req.headers['authorization']?.replace(/^Bearer\s+/i, '') as string) ||
    (req.query?.token as string);

  const expectedToken = getServiceToken();

  if (!token || token.trim() !== expectedToken.trim()) {
    return res.status(401).json({
      error: 'Unauthorized: Invalid or missing server-to-server service token',
    });
  }

  return next();
}

/**
 * Creates a secure session token for an authenticated officer.
 */
export function generateOfficerToken(officer: OfficerUser): string {
  const payload = `${officer.id}:${officer.badgeNumber}:${Date.now()}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}
