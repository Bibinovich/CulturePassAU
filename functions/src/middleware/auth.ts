/**
 * Firebase Auth middleware for Cloud Functions.
 *
 * Uses Firebase Admin SDK to verify ID tokens issued by Firebase Auth.
 *
 * Role hierarchy (loosest → strictest):
 *   user  <  organizer = business = sponsor  <  cityAdmin  <  moderator  <  admin = platformAdmin
 *
 * Roles stored as Firebase custom claims: role, tier, city, country
 * Set via:  admin.auth().setCustomUserClaims(uid, { role: 'organizer', ... })
 */

import type { Request, Response, NextFunction } from 'express';
import { authAdmin } from '../admin';
import type { UserRole } from '@shared/schema';

// ---------------------------------------------------------------------------
// Types — kept identical to server/middleware/auth.ts for drop-in replacement
// ---------------------------------------------------------------------------

export interface RequestUser {
  id: string;
  username: string;
  email?: string;
  role: UserRole;
  tier?: string;
  city?: string;
  country?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: RequestUser;
      accessToken?: string;
    }
  }
}

// ---------------------------------------------------------------------------
// authenticate  (global — attaches req.user when token is present and valid)
// ---------------------------------------------------------------------------

/**
 * Global middleware applied to every request.
 * Attaches `req.user` from the Firebase Bearer token when present and valid.
 * Never rejects; use `requireAuth` or `requireRole` on individual routes.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.slice(7);
  req.accessToken = token;

  try {
    const decoded = await authAdmin.verifyIdToken(token);
    req.user = {
      id: decoded.uid,
      username: (decoded['username'] as string | undefined) ?? decoded.email?.split('@')[0] ?? decoded.uid,
      email: decoded.email,
      role: ((decoded['role'] as UserRole | undefined) ?? 'user'),
      tier: decoded['tier'] as string | undefined,
      city: decoded['city'] as string | undefined,
      country: decoded['country'] as string | undefined,
    };
  } catch {
    // Invalid token — leave req.user undefined; protected routes will reject
  }

  next();
}

// ---------------------------------------------------------------------------
// requireAuth  (route-level — blocks if unauthenticated)
// ---------------------------------------------------------------------------

/**
 * Route-level guard. Rejects with 401 if no authenticated user is present.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}

// ---------------------------------------------------------------------------
// requireRole  (role-based guard)
// ---------------------------------------------------------------------------

/**
 * Role hierarchy (loosest → strictest):
 *   user  < organizer = business = sponsor  < cityAdmin  < moderator  < admin = platformAdmin
 */

const ROLE_RANK: Record<UserRole, number> = {
  user: 0,
  organizer: 1,
  business: 1,
  sponsor: 1,
  cityAdmin: 2,
  moderator: 3,
  admin: 4,
  platformAdmin: 4,
};

/**
 * Route-level role guard.
 * Requires the user to be authenticated AND have at least one of the
 * specified roles. Admins always pass regardless of required roles.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return function roleGuard(req: Request, res: Response, next: NextFunction): void {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const userRank = ROLE_RANK[req.user.role] ?? 0;
    const allowed = allowedRoles.some(
      (role) => req.user!.role === role || userRank >= ROLE_RANK['admin'],
    );
    if (!allowed) {
      res.status(403).json({
        error: 'Forbidden',
        required: allowedRoles,
        current: req.user.role,
      });
      return;
    }
    next();
  };
}

// ---------------------------------------------------------------------------
// isOwnerOrAdmin  (ownership helper)
// ---------------------------------------------------------------------------

/**
 * Returns true if the user owns the resource (matching ownerId) OR is an admin/moderator/cityAdmin/platformAdmin.
 */
export function isOwnerOrAdmin(user: RequestUser, ownerId: string | null | undefined): boolean {
  const elevatedRoles: UserRole[] = ['admin', 'platformAdmin', 'moderator', 'cityAdmin'];
  if (elevatedRoles.includes(user.role)) return true;
  return !!ownerId && user.id === ownerId;
}
