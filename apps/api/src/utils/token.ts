import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { Role } from '../models/enums.js';

export interface TokenPayload {
  userId: string;
  role: Role;
}

/**
 * Signs a JWT session token with userId and role.
 */
export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

/**
 * Verifies a JWT session token and returns the decoded payload.
 * Returns null if token is expired, invalid, or malformed.
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as TokenPayload;
    if (!decoded.userId || !decoded.role) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}
