import { Request, Response } from 'express';
import mongoose, { FilterQuery } from 'mongoose';
import { Report, IReport } from '../models/Report.js';
import { STATUS_VALUES, Status } from '../models/enums.js';
import {
  adminReportQuerySchema,
  updatePrioritySchema,
  updateStatusSchema,
} from '../validators/index.js';

const ACTIVE_STATUSES: Status[] = ['submitted', 'under_review', 'in_progress'];

const ALLOWED_TRANSITIONS: Record<Status, Status[]> = {
  submitted: ['under_review', 'rejected'],
  under_review: ['in_progress', 'rejected'],
  in_progress: ['resolved', 'rejected'],
  resolved: [],
  rejected: [],
};

function findReportByIdOrNumber(id: string) {
  return mongoose.Types.ObjectId.isValid(id)
    ? Report.findOne({ $or: [{ _id: id }, { reportNumber: id }] })
    : Report.findOne({ reportNumber: id });
}

export async function getAdminDashboard(req: Request, res: Response): Promise<void> {
  const parsedQuery = adminReportQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    res.status(422).json({
      error: 'Validation failed',
      details: parsedQuery.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    });
    return;
  }

  const { status, category, priority, page, limit } = parsedQuery.data;
  const filter: FilterQuery<IReport> = { isDemoData: false };
  filter.status = status ? status : { $in: ACTIVE_STATUSES };
  if (category) filter.category = category;
  if (priority) filter.priority = priority;

  try {
    const [reports, total, statusCounts] = await Promise.all([
      Report.find(filter)
        .populate('createdBy', 'name')
        .sort({ createdAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Report.countDocuments(filter),
      Promise.all(
        STATUS_VALUES.map(
          async (reportStatus) =>
            [
              reportStatus,
              await Report.countDocuments({ isDemoData: false, status: reportStatus }),
            ] as const,
        ),
      ),
    ]);

    res.json({
      reports,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
      summary: Object.fromEntries(statusCounts),
    });
  } catch (error) {
    console.error('[ADMIN] Failed to load reviewer dashboard:', (error as Error).message);
    res.status(500).json({ error: 'Unable to load the reviewer dashboard' });
  }
}

export async function updateReportStatus(req: Request, res: Response): Promise<void> {
  const parsed = updateStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({
      error: 'Validation failed',
      details: parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    });
    return;
  }

  try {
    const report = await findReportByIdOrNumber(String(req.params.id));
    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    const { status, note } = parsed.data;
    if (!ALLOWED_TRANSITIONS[report.status].includes(status)) {
      res.status(422).json({
        error: `Invalid status transition from ${report.status} to ${status}`,
      });
      return;
    }

    const previousStatus = report.status;
    report.status = status;
    report.statusHistory.push({
      fromStatus: previousStatus,
      toStatus: status,
      changedBy: req.user!.id,
      note,
      changedAt: new Date(),
    });
    if (status === 'resolved') report.resolutionNote = note;
    if (status === 'rejected') report.rejectionReason = note;

    await report.save();
    res.json({ message: 'Report status updated', report });
  } catch (error) {
    console.error('[ADMIN] Failed to update report status:', (error as Error).message);
    res.status(500).json({ error: 'Unable to update report status' });
  }
}

export async function updateReportPriority(req: Request, res: Response): Promise<void> {
  const parsed = updatePrioritySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({
      error: 'Validation failed',
      details: parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    });
    return;
  }

  try {
    const report = await findReportByIdOrNumber(String(req.params.id));
    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    const { priority, note } = parsed.data;
    if (report.priority === priority) {
      res.json({ message: 'Report priority is unchanged', report });
      return;
    }

    const previousPriority = report.priority;
    report.priority = priority;
    report.priorityHistory.push({
      fromPriority: previousPriority,
      toPriority: priority,
      changedBy: req.user!.id,
      note,
      changedAt: new Date(),
    });

    await report.save();
    res.json({ message: 'Report priority updated', report });
  } catch (error) {
    console.error('[ADMIN] Failed to update report priority:', (error as Error).message);
    res.status(500).json({ error: 'Unable to update report priority' });
  }
}
