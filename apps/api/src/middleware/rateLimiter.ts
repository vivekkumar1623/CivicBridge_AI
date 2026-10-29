import rateLimit from 'express-rate-limit';
import { config } from '../config/index.js';

/**
 * Rate limiter for authentication endpoints (register and login).
 * Prevents credential stuffing and brute-force attacks.
 * Disabled in test environment.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.nodeEnv === 'test',
  message: {
    error: 'Too many authentication attempts, please try again after 15 minutes',
  },
});

export const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.nodeEnv === 'test',
  message: {
    error: 'Too many AI suggestion requests, please try again later',
  },
});
