import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/token.js';
import { SESSION_COOKIE_NAME } from '../utils/cookies.js';
import { User } from '../models/User.js';
import { Role } from '../models/enums.js';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthenticatedUser;
  }
}

/**
 * Middleware: requireAuth
 * Ensures the request is authenticated via HTTP-only session cookie or Authorization header.
 * Derives user ID and role authoritatively from the verified session.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  let token: string | undefined;

  // 1. Check HTTP-only session cookie first
  if (req.cookies && req.cookies[SESSION_COOKIE_NAME]) {
    token = req.cookies[SESSION_COOKIE_NAME];
  }
  // 2. Fall back to Authorization: Bearer <token>
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.slice(7).trim();
  }

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }

  try {
    const user = await User.findById(payload.userId);
    if (!user) {
      res.status(401).json({ error: 'User account not found' });
      return;
    }

    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    };

    next();
  } catch {
    res.status(500).json({ error: 'Internal server error during authentication' });
  }
}

/**
 * Middleware: requireAdmin
 * Enforces admin-only access. Must be used after requireAuth.
 * Rejects non-admin users with HTTP 403 Forbidden.
 */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Access denied: Admin privileges required' });
    return;
  }

  next();
}
