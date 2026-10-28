import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { registerSchema, loginSchema } from '../validators/index.js';
import { signToken } from '../utils/token.js';
import { setSessionCookie, clearSessionCookie } from '../utils/cookies.js';

const BCRYPT_SALT_ROUNDS = 12;

/**
 * POST /api/auth/register
 * Creates a new citizen account.
 * Role from request body is strictly ignored; public registration always creates citizen.
 */
export async function register(req: Request, res: Response): Promise<void> {
  const parseResult = registerSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'Validation failed',
      details: parseResult.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      })),
    });
    return;
  }

  const { name, email, password } = parseResult.data;

  try {
    // Check if user already exists
    const existing = await User.findOne({ email });
    if (existing) {
      // Generic message to prevent email enumeration
      res.status(409).json({ error: 'Registration failed or email is already registered' });
      return;
    }

    // Hash password with bcrypt
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // Create user strictly with role: 'citizen'
    const user = await User.create({
      name,
      email,
      passwordHash,
      role: 'citizen',
    });

    const token = signToken({
      userId: user._id.toString(),
      role: 'citizen',
    });

    setSessionCookie(res, token);

    res.status(201).json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('[AUTH] Registration error:', (error as Error).message);
    res.status(500).json({ error: 'Internal server error during registration' });
  }
}

/**
 * POST /api/auth/login
 * Authenticates user credentials and sets signed HTTP-only session cookie.
 * Generic error returned for non-existent users and bad passwords.
 */
export async function login(req: Request, res: Response): Promise<void> {
  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'Validation failed',
      details: parseResult.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      })),
    });
    return;
  }

  const { email, password } = parseResult.data;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = signToken({
      userId: user._id.toString(),
      role: user.role,
    });

    setSessionCookie(res, token);

    res.json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('[AUTH] Login error:', (error as Error).message);
    res.status(500).json({ error: 'Internal server error during login' });
  }
}

/**
 * POST /api/auth/logout
 * Clears the session cookie.
 */
export function logout(_req: Request, res: Response): void {
  clearSessionCookie(res);
  res.json({ message: 'Logged out successfully' });
}

/**
 * GET /api/auth/me
 * Returns authenticated user safe profile.
 */
export function getMe(req: Request, res: Response): void {
  res.json({ user: req.user });
}
