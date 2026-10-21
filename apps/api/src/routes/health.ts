import { Router, Request, Response } from 'express';

const healthRouter = Router();

/**
 * GET /api/health
 * Returns API service status. Does not expose secrets or require MongoDB.
 */
healthRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'civicbridge-api',
    timestamp: new Date().toISOString(),
  });
});

export { healthRouter };
