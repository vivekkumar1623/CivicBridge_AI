import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { app } from '../src/app.js';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { User, Report } from '../src/models/index.js';
import { config } from '../src/config/index.js';
import { signToken } from '../src/utils/token.js';
import { SESSION_COOKIE_NAME } from '../src/utils/cookies.js';
import { LocalPhotoStorage, photoStorage } from '../src/services/photoStorage.js';

describe('Phases 4 and 5 - Reports and Photos', () => {
  let user1Token: string;
  let user2Token: string;
  let adminToken: string;
  let user1Id: string;
  let user2Id: string;
  let createdReportNumber: string;
  let createdReportId: string;
  let photoReportNumber: string;
  const storedPhotoKeys: string[] = [];

  beforeAll(async () => {
    await connectDatabase();
    await User.init();
    await Report.init();

    // Clean up test users and reports
    await User.deleteMany({ email: /@test-reports\.com$/ });
    await Report.deleteMany({ title: /^\[TEST-P[45]\]/ });

    // Create User 1 (Citizen)
    const u1 = await User.create({
      name: 'Citizen One',
      email: 'citizen1@test-reports.com',
      passwordHash: 'dummyhash',
      role: 'citizen',
    });
    user1Id = u1._id.toString();
    user1Token = signToken({ userId: user1Id, role: 'citizen' });

    // Create User 2 (Another Citizen)
    const u2 = await User.create({
      name: 'Citizen Two',
      email: 'citizen2@test-reports.com',
      passwordHash: 'dummyhash',
      role: 'citizen',
    });
    user2Id = u2._id.toString();
    user2Token = signToken({ userId: user2Id, role: 'citizen' });

    // Create Admin User
    const admin = await User.create({
      name: 'Admin Reviewer',
      email: 'admin@test-reports.com',
      passwordHash: 'dummyhash',
      role: 'admin',
    });
    adminToken = signToken({ userId: admin._id.toString(), role: 'admin' });
  });

  afterAll(async () => {
    await User.deleteMany({ email: /@test-reports\.com$/ });
    await Report.deleteMany({ title: /^\[TEST-P[45]\]/ });
    await Promise.all(storedPhotoKeys.map((key) => photoStorage.delete(key)));
    await disconnectDatabase();
  });

  describe('Photo storage configuration', () => {
    it('should reject upload directories inside the web application', () => {
      const testDirectory = path.dirname(fileURLToPath(import.meta.url));
      const webUploads = path.resolve(testDirectory, '../../../apps/web/public/uploads');

      expect(() => new LocalPhotoStorage(webUploads)).toThrow(
        'UPLOAD_DIR must be outside the frontend directory',
      );
    });
  });

  describe('POST /api/reports', () => {
    it('should submit a valid text-only report and return 201', async () => {
      const res = await request(app)
        .post('/api/reports')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${user1Token}`])
        .send({
          title: '[TEST-P4] Deep pothole near hostel road',
          description:
            'A deep pothole has formed near the entrance road and vehicles are swerving around it.',
          category: 'road_damage',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('report');
      const r = res.body.report;
      expect(r.reportNumber).toMatch(/^CB-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
      expect(r.status).toBe('submitted');
      expect(r.priority).toBe('normal');
      expect(r.statusHistory).toHaveLength(1);
      expect(r.statusHistory[0].toStatus).toBe('submitted');

      createdReportNumber = r.reportNumber;
      createdReportId = r._id;
    });

    it('should submit a report with coordinates in GeoJSON [longitude, latitude]', async () => {
      const res = await request(app)
        .post('/api/reports')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${user1Token}`])
        .send({
          title: '[TEST-P4] Streetlight outage in parking area',
          description:
            'The light pole is completely dark creating safety concerns for pedestrians at night.',
          category: 'streetlight',
          latitude: 28.7041,
          longitude: 77.1025,
          locationLabel: 'North Parking Lot',
        });

      expect(res.status).toBe(201);
      expect(res.body.report.location).toBeDefined();
      expect(res.body.report.location.coordinates).toEqual([77.1025, 28.7041]);
      expect(res.body.report.locationLabel).toBe('North Parking Lot');
    });

    it('should re-encode a valid image and store only a private random key', async () => {
      const inputImage = await sharp({
        create: {
          width: 1800,
          height: 900,
          channels: 3,
          background: '#cc3311',
        },
      })
        .withMetadata({ orientation: 6 })
        .jpeg()
        .toBuffer();

      const res = await request(app)
        .post('/api/reports')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${user1Token}`])
        .field('title', '[TEST-P5] Broken curb with photo')
        .field(
          'description',
          'A broken curb is blocking the accessible path beside the campus library.',
        )
        .field('category', 'public_property')
        .attach('photo', inputImage, {
          filename: 'original-name.jpg',
          contentType: 'image/jpeg',
        });

      expect(res.status).toBe(201);
      const key = res.body.report.photoKey as string;
      storedPhotoKeys.push(key);
      photoReportNumber = res.body.report.reportNumber;
      expect(key).toMatch(/^[0-9a-f-]{36}\.jpg$/i);
      expect(JSON.stringify(res.body)).not.toContain('original-name.jpg');
      expect(JSON.stringify(res.body)).not.toMatch(/[A-Z]:\\\\|\/uploads\//i);

      const storedStream = await photoStorage.open(key);
      expect(storedStream).not.toBeNull();
      const chunks: Buffer[] = [];
      for await (const chunk of storedStream!) {
        chunks.push(Buffer.from(chunk));
      }

      const metadata = await sharp(Buffer.concat(chunks)).metadata();
      expect(metadata.format).toBe('jpeg');
      expect(Math.max(metadata.width ?? 0, metadata.height ?? 0)).toBeLessThanOrEqual(1600);
      expect(metadata.exif).toBeUndefined();
    });

    it('should reject an image when its declared MIME type does not match its signature', async () => {
      const pngImage = await sharp({
        create: {
          width: 10,
          height: 10,
          channels: 3,
          background: '#3366cc',
        },
      })
        .png()
        .toBuffer();

      const res = await request(app)
        .post('/api/reports')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${user1Token}`])
        .field('title', '[TEST-P5] Incorrect image type')
        .field('description', 'The public notice board has been damaged and needs inspection.')
        .field('category', 'public_property')
        .attach('photo', pngImage, {
          filename: 'photo.jpg',
          contentType: 'image/jpeg',
        });

      expect(res.status).toBe(415);
    });

    it('should accept PNG and WebP images', async () => {
      const baseImage = sharp({
        create: {
          width: 10,
          height: 10,
          channels: 3,
          background: '#3366cc',
        },
      });
      const images = [
        {
          mimeType: 'image/png',
          filename: 'photo.png',
          buffer: await baseImage.clone().png().toBuffer(),
        },
        {
          mimeType: 'image/webp',
          filename: 'photo.webp',
          buffer: await baseImage.clone().webp().toBuffer(),
        },
      ];

      for (const image of images) {
        const res = await request(app)
          .post('/api/reports')
          .set('Cookie', [`${SESSION_COOKIE_NAME}=${user1Token}`])
          .field('title', `[TEST-P5] Valid ${image.mimeType}`)
          .field('description', 'The public notice board has been damaged and needs inspection.')
          .field('category', 'public_property')
          .attach('photo', image.buffer, {
            filename: image.filename,
            contentType: image.mimeType,
          });

        expect(res.status).toBe(201);
        storedPhotoKeys.push(res.body.report.photoKey);
      }
    });

    it('should reject malformed image data', async () => {
      const res = await request(app)
        .post('/api/reports')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${user1Token}`])
        .field('title', '[TEST-P5] Invalid photo data')
        .field('description', 'The public notice board has been damaged and needs inspection.')
        .field('category', 'public_property')
        .attach('photo', Buffer.from('not an image'), {
          filename: 'photo.jpg',
          contentType: 'image/jpeg',
        });

      expect(res.status).toBe(422);
    });

    it('should reject photos larger than the configured upload limit', async () => {
      const res = await request(app)
        .post('/api/reports')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${user1Token}`])
        .field('title', '[TEST-P5] Oversized photo')
        .field('description', 'The public notice board has been damaged and needs inspection.')
        .field('category', 'public_property')
        .attach('photo', Buffer.alloc(config.maxUploadBytes + 1), {
          filename: 'too-large.jpg',
          contentType: 'image/jpeg',
        });

      expect(res.status).toBe(413);
    });

    it('should accept no more than one photo', async () => {
      const image = await sharp({
        create: {
          width: 10,
          height: 10,
          channels: 3,
          background: '#3366cc',
        },
      })
        .jpeg()
        .toBuffer();

      const res = await request(app)
        .post('/api/reports')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${user1Token}`])
        .field('title', '[TEST-P5] Multiple photos')
        .field('description', 'The public notice board has been damaged and needs inspection.')
        .field('category', 'public_property')
        .attach('photo', image, { filename: 'one.jpg', contentType: 'image/jpeg' })
        .attach('photo', image, { filename: 'two.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(400);
    });

    it('should delete the stored photo if database creation fails', async () => {
      const image = await sharp({
        create: {
          width: 10,
          height: 10,
          channels: 3,
          background: '#3366cc',
        },
      })
        .jpeg()
        .toBuffer();
      let savedKey: string | undefined;
      const save = photoStorage.save.bind(photoStorage);
      const saveSpy = vi
        .spyOn(photoStorage, 'save')
        .mockImplementation(async (buffer, mimeType) => {
          savedKey = await save(buffer, mimeType);
          return savedKey;
        });
      const createSpy = vi
        .spyOn(Report, 'create')
        .mockRejectedValue(new Error('simulated persistence failure'));

      try {
        const res = await request(app)
          .post('/api/reports')
          .set('Cookie', [`${SESSION_COOKIE_NAME}=${user1Token}`])
          .field('title', '[TEST-P5] Database failure cleanup')
          .field('description', 'The public notice board has been damaged and needs inspection.')
          .field('category', 'public_property')
          .attach('photo', image, { filename: 'cleanup.jpg', contentType: 'image/jpeg' });

        expect(res.status).toBe(500);
        expect(savedKey).toBeDefined();
        if (savedKey) {
          expect(await photoStorage.open(savedKey)).toBeNull();
        }
      } finally {
        saveSpy.mockRestore();
        createSpy.mockRestore();
      }
    });

    it('should ignore client-supplied status, priority, and isDemoData overrides', async () => {
      const res = await request(app)
        .post('/api/reports')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${user1Token}`])
        .send({
          title: '[TEST-P4] Garbage pile accumulation',
          description:
            'Overflowing municipal waste bin near the canteen block attracting stray animals.',
          category: 'waste_management',
          status: 'resolved', // Client attempt to auto-resolve
          priority: 'high', // Client attempt to set priority
          isDemoData: true,
        });

      expect(res.status).toBe(201);
      // Status must still be 'submitted', priority must still be 'normal'
      expect(res.body.report.status).toBe('submitted');
      expect(res.body.report.priority).toBe('normal');
      expect(res.body.report.isDemoData).toBe(false);
    });

    it('should reject descriptions shorter than 20 characters with 400', async () => {
      const res = await request(app)
        .post('/api/reports')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${user1Token}`])
        .send({
          title: '[TEST-P4] Short description',
          description: 'Too short',
          category: 'road_damage',
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Validation failed');
    });

    it('should reject invalid category with 400', async () => {
      const res = await request(app)
        .post('/api/reports')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${user1Token}`])
        .send({
          title: '[TEST-P4] Valid title here',
          description: 'A valid description of twenty characters or more.',
          category: 'invalid_category_name',
        });

      expect(res.status).toBe(400);
    });

    it('should reject unauthenticated report creation with 401', async () => {
      const res = await request(app).post('/api/reports').send({
        title: '[TEST-P4] No Auth report',
        description: 'A valid description of twenty characters or more.',
        category: 'road_damage',
      });

      expect(res.status).toBe(401);
    });

  });

  describe('GET /api/reports/mine', () => {
    it('should return paginated reports created by the authenticated citizen only', async () => {
      const res = await request(app)
        .get('/api/reports/mine?page=1&limit=10')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${user1Token}`]);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('reports');
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.reports.length).toBeGreaterThanOrEqual(1);

      // Verify all returned reports belong to user1
      res.body.reports.forEach((report: any) => {
        expect(report.createdBy.toString()).toBe(user1Id);
      });
    });

    it('should return an empty list for a citizen with no reports', async () => {
      const res = await request(app)
        .get('/api/reports/mine')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${user2Token}`]);

      expect(res.status).toBe(200);
      expect(res.body.reports).toEqual([]);
      expect(res.body.pagination.total).toBe(0);
    });

    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/reports/mine');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/reports/:id', () => {
    it('should allow the owner citizen to fetch their report details', async () => {
      const res = await request(app)
        .get(`/api/reports/${createdReportNumber}`)
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${user1Token}`]);

      expect(res.status).toBe(200);
      expect(res.body.report.reportNumber).toBe(createdReportNumber);
      expect(res.body.report.statusHistory).toBeDefined();
    });

    it('should allow an admin to fetch any report', async () => {
      const res = await request(app)
        .get(`/api/reports/${createdReportNumber}`)
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${adminToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.report.reportNumber).toBe(createdReportNumber);
    });

    it('should reject another citizen with HTTP 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/reports/${createdReportNumber}`)
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${user2Token}`]);

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty(
        'error',
        'Access denied: You do not have permission to view this report',
      );
    });

    it('should return 404 for non-existent report', async () => {
      const res = await request(app)
        .get('/api/reports/CB-NONEXIST')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${user1Token}`]);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/reports/:id/photo', () => {
    it('should return 404 when report has no photo attached', async () => {
      const res = await request(app)
        .get(`/api/reports/${createdReportNumber}/photo`)
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${user1Token}`]);

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error', 'Report has no attached photo');
    });

    it('should reject unauthorized citizen accessing photo endpoint with 403', async () => {
      const res = await request(app)
        .get(`/api/reports/${createdReportNumber}/photo`)
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${user2Token}`]);

      expect(res.status).toBe(403);
    });

    it('should allow the owner to retrieve a stored photo', async () => {
      const res = await request(app)
        .get(`/api/reports/${photoReportNumber}/photo`)
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${user1Token}`]);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/^image\/jpeg/);
    });

    it('should allow an admin to retrieve a stored photo', async () => {
      const res = await request(app)
        .get(`/api/reports/${photoReportNumber}/photo`)
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${adminToken}`]);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/^image\/jpeg/);
    });

    it('should deny another citizen access to a stored photo', async () => {
      const res = await request(app)
        .get(`/api/reports/${photoReportNumber}/photo`)
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${user2Token}`]);

      expect(res.status).toBe(403);
    });
  });
});
