import { Router } from 'express';
import {
  getAdminDashboard,
  updateReportPriority,
  updateReportStatus,
} from '../controllers/admin.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';

const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);
adminRouter.get('/reports', getAdminDashboard);
adminRouter.patch('/reports/:id/status', updateReportStatus);
adminRouter.patch('/reports/:id/priority', updateReportPriority);

export { adminRouter };
