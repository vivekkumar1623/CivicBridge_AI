import { Router } from 'express';
import { suggestCategory } from '../controllers/ai.js';
import { requireAuth } from '../middleware/auth.js';
import { aiLimiter } from '../middleware/rateLimiter.js';

const aiRouter = Router();

aiRouter.post('/category-suggestion', requireAuth, aiLimiter, suggestCategory);

export { aiRouter };
