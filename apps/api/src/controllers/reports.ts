import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Report } from '../models/Report.js';
import { IUser } from '../models/User.js';
import { createReportSchema } from '../validators/index.js';
import { generateReportNumber } from '../utils/reportId.js';
import {
  InvalidPhotoError,
  photoStorage,
  UnsupportedPhotoError,
} from '../services/photoStorage.js';

/**
 * POST /api/reports
 * Authenticated citizen creates a new issue report.
 * Accepts multipart/form-data or application/json.
 */
export async function createReport(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  // Parse and validate request fields
  const parseResult = createReportSchema.safeParse(req.body);
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

  const { title, description, category, latitude, longitude, locationLabel } = parseResult.data;

  let photoKey: string | undefined;
  try {
    // Generate unique collision-checked public report ID
    let reportNumber = generateReportNumber();
    let collisionCheck = await Report.exists({ reportNumber });
    while (collisionCheck) {
      reportNumber = generateReportNumber();
      collisionCheck = await Report.exists({ reportNumber });
    }

    // Build GeoJSON Point if both coordinates are provided
    let location = undefined;
    if (latitude !== undefined && longitude !== undefined) {
      location = {
        type: 'Point' as const,
        coordinates: [longitude, latitude] as [number, number],
      };
    }

    if (req.file) {
      photoKey = await photoStorage.save(req.file.buffer, req.file.mimetype);
    }

    // Server authoritatively sets createdBy, status, priority, and first statusHistory
    const initialStatusHistory = {
      fromStatus: null,
      toStatus: 'submitted' as const,
      changedBy: req.user.id,
      note: 'Initial report submission by citizen',
      changedAt: new Date(),
    };

    const report = await Report.create({
      reportNumber,
      createdBy: new mongoose.Types.ObjectId(req.user.id),
      title,
      description,
      category,
      status: 'submitted',
      priority: 'normal',
      location,
      locationLabel: locationLabel || undefined,
      photoKey,
      statusHistory: [initialStatusHistory],
      isDemoData: false,
    });

    res.status(201).json({
      message: 'Report submitted successfully',
      report,
    });
  } catch (error) {
    if (photoKey) {
      try {
        await photoStorage.delete(photoKey);
      } catch {
        console.error('[REPORTS] Failed to clean up an unlinked uploaded photo.');
      }
    }

    if (error instanceof UnsupportedPhotoError) {
      res.status(415).json({
        error: 'Photo must be a JPEG, PNG, or WebP image matching its file type.',
      });
      return;
    }
    if (error instanceof InvalidPhotoError) {
      res.status(422).json({ error: 'The uploaded photo could not be decoded.' });
      return;
    }

    console.error('[REPORTS] Error creating report:', (error as Error).message);
    res.status(500).json({ error: 'Internal server error while creating report' });
  }
}

/**
 * GET /api/reports/mine?page=1&limit=10
 * Returns paginated reports created by the authenticated citizen (newest first).
 */
export async function getMyReports(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
  const skip = (page - 1) * limit;

  try {
    const filter = { createdBy: new mongoose.Types.ObjectId(req.user.id) };

    const [reports, total] = await Promise.all([
      Report.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Report.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    res.json({
      reports,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error) {
    console.error('[REPORTS] Error fetching user reports:', (error as Error).message);
    res.status(500).json({ error: 'Internal server error while fetching reports' });
  }
}

/**
 * GET /api/reports/:id
 * Fetches a report by its MongoDB _id or public reportNumber.
 * Authorization rule: Owner or Admin only.
 */
export async function getReportById(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const id = String(req.params.id);

  try {
    const isObjectId = mongoose.Types.ObjectId.isValid(id);
    const query = isObjectId ? { $or: [{ _id: id }, { reportNumber: id }] } : { reportNumber: id };

    const report = await Report.findOne(query).populate<{
      createdBy: mongoose.Types.ObjectId | Pick<IUser, '_id' | 'name' | 'email'> | null;
    }>('createdBy', 'name email');
    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    // Owner or Admin only check
    const createdBy = report.createdBy;
    const reportOwnerId = createdBy
      ? 'name' in createdBy
        ? createdBy._id.toString()
        : createdBy.toString()
      : '';

    const isOwner = reportOwnerId === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      res.status(403).json({
        error: 'Access denied: You do not have permission to view this report',
      });
      return;
    }

    res.json({ report });
  } catch (error) {
    console.error('[REPORTS] Error fetching report by ID:', (error as Error).message);
    res.status(500).json({ error: 'Internal server error while fetching report' });
  }
}

/**
 * GET /api/reports/:id/photo
 * Securely streams the uploaded photo for a report.
 * Authorization rule: Owner or Admin only.
 */
export async function getReportPhoto(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const id = String(req.params.id);

  try {
    const isObjectId = mongoose.Types.ObjectId.isValid(id);
    const query = isObjectId ? { $or: [{ _id: id }, { reportNumber: id }] } : { reportNumber: id };

    const report = await Report.findOne(query);
    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    const isOwner = report.createdBy.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      res.status(403).json({
        error: 'Access denied: You do not have permission to view this photo',
      });
      return;
    }

    if (!report.photoKey) {
      res.status(404).json({ error: 'Report has no attached photo' });
      return;
    }

    const photo = await photoStorage.open(report.photoKey);
    if (!photo) {
      res.status(404).json({ error: 'Photo file not found on server' });
      return;
    }

    res.type('image/jpeg');
    photo.on('error', () => {
      if (!res.headersSent) {
        console.error('[REPORTS] Failed to stream a stored photo.');
        res.status(500).json({ error: 'Internal server error while retrieving photo' });
      } else {
        res.destroy();
      }
    });
    photo.pipe(res);
  } catch (error) {
    console.error('[REPORTS] Error streaming photo:', (error as Error).message);
    res.status(500).json({ error: 'Internal server error while retrieving photo' });
  }
}
