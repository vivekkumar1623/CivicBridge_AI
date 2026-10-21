import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config/index.js';
import { healthRouter } from './routes/health.js';

const app = express();

// Security headers
app.use(helmet());

// CORS — restrict to web origin with credentials
app.use(
  cors({
    origin: config.webOrigin,
    credentials: true,
  }),
);

// Cookie parsing
app.use(cookieParser());

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// Routes
app.use('/api', healthRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler — never expose stack traces or secrets
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(`[ERROR] ${err.message}`);
  res.status(500).json({ error: 'Internal server error' });
});

export { app };
