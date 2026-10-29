import { z } from 'zod';
import { CATEGORY_VALUES, STATUS_VALUES, PRIORITY_VALUES } from '../models/enums.js';

/**
 * Citizen Registration Validation
 * Enforces: name (2-80 chars), valid email, password min 10 characters.
 * Role must NEVER be accepted from the request body.
 */
export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(80, 'Name cannot exceed 80 characters'),
  email: z.string().trim().toLowerCase().email('Please provide a valid email address'),
  password: z.string().min(10, 'Password must be at least 10 characters for prototype security'),
});

export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Citizen / Admin Login Validation
 */
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please provide a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Report Creation Validation (API Boundary)
 * Enforces:
 * - title: 5-100 characters
 * - description: 20-2000 characters
 * - category: valid fixed enum
 * - coordinates: latitude [-90, 90], longitude [-180, 180]
 * - Browser-supplied status, priority, createdBy, aiConfidence are omitted/ignored.
 */
export const createReportSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, 'Title must be at least 5 characters')
    .max(100, 'Title cannot exceed 100 characters'),
  description: z
    .string()
    .trim()
    .min(20, 'Description must be at least 20 characters')
    .max(2000, 'Description cannot exceed 2000 characters'),
  category: z.enum(CATEGORY_VALUES, {
    message: 'Please select a valid issue category',
  }),
  latitude: z.coerce
    .number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90')
    .optional(),
  longitude: z.coerce
    .number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180')
    .optional(),
  locationLabel: z
    .string()
    .trim()
    .max(120, 'Location label cannot exceed 120 characters')
    .optional(),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;

export const categorySuggestionRequestSchema = z.object({
  description: z
    .string()
    .trim()
    .min(20, 'Description must be at least 20 characters')
    .max(2000, 'Description cannot exceed 2000 characters'),
});

export const duplicateSuggestionRequestSchema = z
  .object({
    description: z
      .string()
      .trim()
      .min(20, 'Description must be at least 20 characters')
      .max(2000, 'Description cannot exceed 2000 characters'),
    category: z.enum(CATEGORY_VALUES),
    latitude: z.coerce
      .number()
      .min(-90, 'Latitude must be between -90 and 90')
      .max(90, 'Latitude must be between -90 and 90')
      .optional(),
    longitude: z.coerce
      .number()
      .min(-180, 'Longitude must be between -180 and 180')
      .max(180, 'Longitude must be between -180 and 180')
      .optional(),
  })
  .superRefine((data, ctx) => {
    if ((data.latitude === undefined) !== (data.longitude === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Latitude and longitude must be provided together',
        path: [data.latitude === undefined ? 'latitude' : 'longitude'],
      });
    }
  });

export type DuplicateSuggestionInput = z.infer<typeof duplicateSuggestionRequestSchema>;

/**
 * Status Transition Validation (Admin/Reviewer)
 * Enforces:
 * - Valid transition status
 * - Mandatory note (10-500 characters) for resolved or rejected status
 */
export const updateStatusSchema = z
  .object({
    status: z.enum(STATUS_VALUES, {
      message: 'Please provide a valid status',
    }),
    note: z
      .string()
      .trim()
      .min(10, 'Status note must be at least 10 characters')
      .max(500, 'Status note cannot exceed 500 characters')
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status === 'resolved' && !data.note) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A resolution note of 10 to 500 characters is required when resolving a report',
        path: ['note'],
      });
    }
    if (data.status === 'rejected' && !data.note) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A rejection reason of 10 to 500 characters is required when rejecting a report',
        path: ['note'],
      });
    }
  });

export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;

/**
 * Priority Update Validation (Admin/Reviewer)
 */
export const updatePrioritySchema = z.object({
  priority: z.enum(PRIORITY_VALUES, {
    message: 'Please provide a valid priority (low, normal, high)',
  }),
  note: z.string().trim().max(500, 'Priority note cannot exceed 500 characters').optional(),
});

export type UpdatePriorityInput = z.infer<typeof updatePrioritySchema>;

export const adminReportQuerySchema = z.object({
  status: z.enum(STATUS_VALUES).optional(),
  category: z.enum(CATEGORY_VALUES).optional(),
  priority: z.enum(PRIORITY_VALUES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type AdminReportQuery = z.infer<typeof adminReportQuerySchema>;
