import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { User, Report } from '../src/models/index.js';
import { generateReportNumber } from '../src/utils/reportId.js';
import {
  registerSchema,
  loginSchema,
  createReportSchema,
  updateStatusSchema,
} from '../src/validators/index.js';

describe('Phase 2 — Data Models, Validation, and Database Connection', () => {
  beforeAll(async () => {
    await connectDatabase();
    // Ensure unique indexes are built in MongoDB
    await User.init();
    await Report.init();
    // Clean up test collections
    await User.deleteMany({ email: /@test-phase2\.com$/ });
    await Report.deleteMany({ isDemoData: true, title: /^\[TEST\]/ });
  });

  afterAll(async () => {
    // Clean up test documents
    await User.deleteMany({ email: /@test-phase2\.com$/ });
    await Report.deleteMany({ isDemoData: true, title: /^\[TEST\]/ });
    await disconnectDatabase();
  });

  describe('Database Connection', () => {
    it('should connect to MongoDB with readyState 1', () => {
      expect(mongoose.connection.readyState).toBe(1);
    });
  });

  describe('User Model', () => {
    it('should create a valid citizen user and strip passwordHash in JSON serialization', async () => {
      const user = await User.create({
        name: 'Jane Citizen',
        email: 'jane@test-phase2.com',
        passwordHash: '$2a$12$e80Ym15wRz3oJ8qM16z9QO7P48R8u3Fq7u09X7O6N2P8Z5X1Y9K2',
        role: 'citizen',
      });

      expect(user._id).toBeDefined();
      expect(user.name).toBe('Jane Citizen');
      expect(user.email).toBe('jane@test-phase2.com');
      expect(user.role).toBe('citizen');

      // Verify toJSON serialization strips passwordHash
      const serialized = user.toJSON();
      expect(serialized).not.toHaveProperty('passwordHash');
      expect(serialized).not.toHaveProperty('__v');
      expect(serialized).toHaveProperty('name', 'Jane Citizen');
      expect(serialized).toHaveProperty('email', 'jane@test-phase2.com');
    });

    it('should reject duplicate email with a Mongo duplicate key error', async () => {
      await expect(
        User.create({
          name: 'Another Jane',
          email: 'jane@test-phase2.com',
          passwordHash: 'another-hash',
        }),
      ).rejects.toThrow();
    });

    it('should reject invalid email format', async () => {
      await expect(
        User.create({
          name: 'Invalid Email User',
          email: 'not-an-email',
          passwordHash: 'somehash',
        }),
      ).rejects.toThrow(/valid email/i);
    });

    it('should reject names shorter than 2 characters', async () => {
      await expect(
        User.create({
          name: 'A',
          email: 'short@test-phase2.com',
          passwordHash: 'somehash',
        }),
      ).rejects.toThrow(/at least 2 characters/i);
    });
  });

  describe('Report Model', () => {
    let testUserId: mongoose.Types.ObjectId;

    beforeAll(async () => {
      const user = await User.create({
        name: 'Reporter User',
        email: 'reporter@test-phase2.com',
        passwordHash: 'hashedpassword',
      });
      testUserId = user._id as mongoose.Types.ObjectId;
    });

    it('should generate collision-checked unique report numbers', () => {
      const num1 = generateReportNumber();
      const num2 = generateReportNumber();
      expect(num1).toMatch(/^CB-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
      expect(num2).toMatch(/^CB-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
      expect(num1).not.toBe(num2);
    });

    it('should create a valid report with coordinates and status history', async () => {
      const reportNum = generateReportNumber();
      const report = await Report.create({
        reportNumber: reportNum,
        createdBy: testUserId,
        title: '[TEST] Deep pothole near sector 4 gate',
        description: 'Vehicles are swerving into oncoming traffic to avoid the large pothole.',
        category: 'road_damage',
        status: 'submitted',
        priority: 'normal',
        location: {
          type: 'Point',
          coordinates: [77.1025, 28.7041], // [longitude, latitude]
        },
        locationLabel: 'Sector 4 Gate',
        statusHistory: [
          {
            fromStatus: null,
            toStatus: 'submitted',
            changedBy: testUserId,
            note: 'Initial report submission by citizen',
          },
        ],
        isDemoData: true,
      });

      expect(report._id).toBeDefined();
      expect(report.reportNumber).toBe(reportNum);
      expect(report.location?.coordinates).toEqual([77.1025, 28.7041]);
      expect(report.statusHistory).toHaveLength(1);
      expect(report.statusHistory[0].toStatus).toBe('submitted');
    });

    it('should reject invalid category not in fixed enum', async () => {
      await expect(
        Report.create({
          reportNumber: generateReportNumber(),
          createdBy: testUserId,
          title: '[TEST] Invalid category report',
          description: 'A valid description of twenty characters or more.',
          category: 'alien_invasion' as any,
          isDemoData: true,
        }),
      ).rejects.toThrow(/not a valid category/i);
    });

    it('should reject invalid status not in fixed enum', async () => {
      await expect(
        Report.create({
          reportNumber: generateReportNumber(),
          createdBy: testUserId,
          title: '[TEST] Invalid status report',
          description: 'A valid description of twenty characters or more.',
          category: 'streetlight',
          status: 'closed_forever' as any,
          isDemoData: true,
        }),
      ).rejects.toThrow(/not a valid status/i);
    });

    it('should reject coordinates with invalid latitude outside [-90, 90]', async () => {
      await expect(
        Report.create({
          reportNumber: generateReportNumber(),
          createdBy: testUserId,
          title: '[TEST] Invalid lat report',
          description: 'A valid description of twenty characters or more.',
          category: 'water_drainage',
          location: {
            type: 'Point',
            coordinates: [77.1025, 120.0], // Latitude 120 is invalid
          },
          isDemoData: true,
        }),
      ).rejects.toThrow(/Coordinates must be \[longitude, latitude\]/i);
    });

    it('should reject coordinates with invalid longitude outside [-180, 180]', async () => {
      await expect(
        Report.create({
          reportNumber: generateReportNumber(),
          createdBy: testUserId,
          title: '[TEST] Invalid lng report',
          description: 'A valid description of twenty characters or more.',
          category: 'water_drainage',
          location: {
            type: 'Point',
            coordinates: [200.0, 28.5], // Longitude 200 is invalid
          },
          isDemoData: true,
        }),
      ).rejects.toThrow(/Coordinates must be \[longitude, latitude\]/i);
    });

    it('should enforce unique index on reportNumber', async () => {
      const fixedReportNumber = generateReportNumber();
      await Report.create({
        reportNumber: fixedReportNumber,
        createdBy: testUserId,
        title: '[TEST] First report with ID',
        description: 'A valid description of twenty characters or more.',
        category: 'public_property',
        isDemoData: true,
      });

      await expect(
        Report.create({
          reportNumber: fixedReportNumber,
          createdBy: testUserId,
          title: '[TEST] Duplicate report ID',
          description: 'A valid description of twenty characters or more.',
          category: 'public_property',
          isDemoData: true,
        }),
      ).rejects.toThrow();
    });
  });

  describe('Zod Boundary Validation Schemas', () => {
    it('should validate valid user registration payload', () => {
      const valid = registerSchema.safeParse({
        name: 'Citizen Rahul',
        email: 'rahul@example.com',
        password: 'securepassword123',
      });
      expect(valid.success).toBe(true);
    });

    it('should reject passwords shorter than 10 characters', () => {
      const result = registerSchema.safeParse({
        name: 'Citizen Rahul',
        email: 'rahul@example.com',
        password: 'short',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('at least 10 characters');
      }
    });

    it('should validate valid report creation payload', () => {
      const valid = createReportSchema.safeParse({
        title: 'Broken streetlight on 5th cross',
        description: 'The streetlight fixture is completely dark for 3 consecutive nights.',
        category: 'streetlight',
        latitude: 28.7041,
        longitude: 77.1025,
      });
      expect(valid.success).toBe(true);
    });

    it('should reject descriptions shorter than 20 characters', () => {
      const result = createReportSchema.safeParse({
        title: 'Broken streetlight',
        description: 'Too short',
        category: 'streetlight',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('at least 20 characters');
      }
    });

    it('should require a 10-500 char note when resolving a report', () => {
      const withoutNote = updateStatusSchema.safeParse({
        status: 'resolved',
      });
      expect(withoutNote.success).toBe(false);

      const withShortNote = updateStatusSchema.safeParse({
        status: 'resolved',
        note: 'done', // Less than 10 chars
      });
      expect(withShortNote.success).toBe(false);

      const withValidNote = updateStatusSchema.safeParse({
        status: 'resolved',
        note: 'Pothole filled with cold mix asphalt and levelled by campus maintenance team.',
      });
      expect(withValidNote.success).toBe(true);
    });

    it('should require a 10-500 char note when rejecting a report', () => {
      const withoutNote = updateStatusSchema.safeParse({
        status: 'rejected',
      });
      expect(withoutNote.success).toBe(false);

      const withValidNote = updateStatusSchema.safeParse({
        status: 'rejected',
        note: 'Location is outside campus jurisdiction; referred to municipal ward office.',
      });
      expect(withValidNote.success).toBe(true);
    });
  });
});
