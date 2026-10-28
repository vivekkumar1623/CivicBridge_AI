import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { User } from '../src/models/User.js';
import { requireAuth, requireAdmin } from '../src/middleware/auth.js';
import { SESSION_COOKIE_NAME } from '../src/utils/cookies.js';

describe('Phase 3 — Authentication and Access Control', () => {
  beforeAll(async () => {
    await connectDatabase();
    await User.init();
    // Clean up test auth users
    await User.deleteMany({ email: /@test-auth\.com$/ });
  });

  afterAll(async () => {
    await User.deleteMany({ email: /@test-auth\.com$/ });
    await disconnectDatabase();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new citizen user, return 201, and set HTTP-only cookie', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Priya Sharma',
          email: 'priya@test-auth.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).toHaveProperty('id');
      expect(res.body.user).toHaveProperty('name', 'Priya Sharma');
      expect(res.body.user).toHaveProperty('email', 'priya@test-auth.com');
      expect(res.body.user).toHaveProperty('role', 'citizen');
      expect(res.body.user).not.toHaveProperty('passwordHash');

      // Check HTTP-only cookie
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const cookieStr = Array.isArray(cookies) ? cookies.join(';') : cookies;
      expect(cookieStr).toContain(SESSION_COOKIE_NAME);
      expect(cookieStr.toLowerCase()).toContain('httponly');
    });

    it('should prevent privilege escalation: request role admin is ignored and sets role citizen', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Hacker Attempt',
          email: 'escalation@test-auth.com',
          password: 'Password123!',
          role: 'admin', // Attempted escalation
        });

      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe('citizen');

      const savedUser = await User.findOne({ email: 'escalation@test-auth.com' });
      expect(savedUser?.role).toBe('citizen');
    });

    it('should reject duplicate email registration with 409', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Priya Duplicate',
          email: 'priya@test-auth.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(409);
      expect(res.body).toHaveProperty('error');
    });

    it('should reject passwords shorter than 10 characters with 400', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Short Password User',
          email: 'shortpass@test-auth.com',
          password: 'short',
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Validation failed');
    });

    it('should reject invalid email format with 400', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Bad Email User',
          email: 'not-an-email',
          password: 'Password123!',
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Validation failed');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should log in with valid credentials, return 200, and set cookie', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'priya@test-auth.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.user).toHaveProperty('email', 'priya@test-auth.com');
      expect(res.body.user).not.toHaveProperty('passwordHash');

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
    });

    it('should reject incorrect password with generic 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'priya@test-auth.com',
          password: 'WrongPassword!',
        });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Invalid email or password' });
    });

    it('should reject non-existent email with the exact same generic 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nobody@test-auth.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Invalid email or password' });
    });
  });

  describe('GET /api/auth/me', () => {
    let sessionCookie: string;

    beforeAll(async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'priya@test-auth.com',
          password: 'Password123!',
        });
      const rawCookie = loginRes.headers['set-cookie'];
      sessionCookie = Array.isArray(rawCookie) ? rawCookie[0] : (rawCookie as string);
    });

    it('should return 200 with user profile when authenticated via cookie', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', [sessionCookie]);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).toHaveProperty('name', 'Priya Sharma');
      expect(res.body.user).toHaveProperty('email', 'priya@test-auth.com');
      expect(res.body.user).toHaveProperty('role', 'citizen');
    });

    it('should return 401 when no session cookie or token is provided', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'Authentication required');
    });

    it('should return 401 when an invalid/tampered token is provided', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=invalid.jwt.token`]);

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'Invalid or expired session');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should clear session cookie and return 200', async () => {
      const res = await request(app).post('/api/auth/logout');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Logged out successfully');

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const cookieStr = Array.isArray(cookies) ? cookies.join(';') : cookies;
      // Cookie is cleared with max-age=0 or expires in past
      expect(cookieStr).toContain(`${SESSION_COOKIE_NAME}=;`);
    });
  });

  describe('Authorization: requireAdmin Protection', () => {
    let citizenCookie: string;
    let adminCookie: string;

    beforeAll(async () => {
      // 1. Citizen cookie
      const citizenLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'priya@test-auth.com',
          password: 'Password123!',
        });
      citizenCookie = citizenLogin.headers['set-cookie'][0];

      // 2. Admin user
      await User.findOneAndUpdate(
        { email: 'admin-test@test-auth.com' },
        {
          name: 'Test Admin',
          email: 'admin-test@test-auth.com',
          passwordHash: citizenLogin.body.user ? '$2a$12$e80Ym15wRz3oJ8qM16z9QO7P48R8u3Fq7u09X7O6N2P8Z5X1Y9K2' : '',
          role: 'admin',
        },
        { upsert: true, new: true }
      );

      // Login as admin
      const adminLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin-test@test-auth.com',
          password: 'Password123!',
        });
      // Or sign token directly if passwordHash was a stub
      const { signToken } = await import('../src/utils/token.js');
      const adminUser = await User.findOne({ email: 'admin-test@test-auth.com' });
      const adminToken = signToken({
        userId: adminUser!._id.toString(),
        role: 'admin',
      });
      adminCookie = `${SESSION_COOKIE_NAME}=${adminToken}`;
    });

    it('should reject a citizen accessing admin route with HTTP 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/auth/admin-check')
        .set('Cookie', [citizenCookie]);

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error', 'Access denied: Admin privileges required');
    });

    it('should reject unauthenticated request to admin route with HTTP 401', async () => {
      const res = await request(app).get('/api/auth/admin-check');
      expect(res.status).toBe(401);
    });

    it('should allow admin user to access admin route with HTTP 200', async () => {
      const res = await request(app)
        .get('/api/auth/admin-check')
        .set('Cookie', [adminCookie]);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Welcome Admin');
    });
  });
});
