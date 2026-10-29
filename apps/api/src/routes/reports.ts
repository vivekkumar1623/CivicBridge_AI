import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { handleOptionalPhoto } from '../middleware/photoUpload.js';
import { aiLimiter } from '../middleware/rateLimiter.js';
import { getDuplicateSuggestions } from '../controllers/duplicates.js';
import {
  createReport,
  getMyReports,
  getReportById,
  getReportPhoto,
} from '../controllers/reports.js';

const reportsRouter = Router();

// Create new report (supports multipart/form-data with optional single 'photo' field)
reportsRouter.post('/', requireAuth, handleOptionalPhoto, createReport);

// Suggest nearby reports without exposing their titles, descriptions, photos, or owners
reportsRouter.post('/duplicate-suggestions', requireAuth, aiLimiter, getDuplicateSuggestions);

// Get current user's reports (paginated)
reportsRouter.get('/mine', requireAuth, getMyReports);

// Get single report by ID or reportNumber (Owner or Admin only)
reportsRouter.get('/:id', requireAuth, getReportById);

// Stream photo by report ID (Owner or Admin only)
reportsRouter.get('/:id/photo', requireAuth, getReportPhoto);

export { reportsRouter };
