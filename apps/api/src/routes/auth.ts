import { Router } from 'express';
import { register, login, logout, getMe } from '../controllers/auth.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const authRouter = Router();

authRouter.post('/register', authLimiter, register);
authRouter.post('/login', authLimiter, login);
authRouter.post('/logout', logout);
authRouter.get('/me', requireAuth, getMe);
authRouter.get('/admin-check', requireAuth, requireAdmin, (_req, res) => {
  res.json({ message: 'Welcome Admin' });
});

export { authRouter };
