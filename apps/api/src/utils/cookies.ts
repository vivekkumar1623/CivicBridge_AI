import { Response } from 'express';
import { config } from '../config/index.js';

export const SESSION_COOKIE_NAME = 'civicbridge_session';

/**
 * Sets the signed session token as an HTTP-only, same-site cookie.
 */
export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
    maxAge: 24 * 60 * 60 * 1000, // 1 day
    path: '/',
  });
}

/**
 * Clears the session cookie on logout.
 */
export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
    path: '/',
  });
}
