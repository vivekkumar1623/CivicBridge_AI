import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { Report, User } from '../src/models/index.js';
import { SESSION_COOKIE_NAME } from '../src/utils/cookies.js';
import { signToken } from '../src/utils/token.js';

describe('Phase 8 - Reviewer dashboard and workflow', () => {
  let citizenToken: string;
  let adminToken: string;
  let citizenId: string;
  let adminId: string;

  beforeAll(async () => {
    await connectDatabase();
    await User.init();
    await Report.init();
    await User.deleteMany({ email: /@test-admin-dashboard\.com$/ });
    await Report.deleteMany({ title: /^\[TEST-P8\]/ });

    const citizen = await User.create({
      name: 'Dashboard Citizen',
      email: 'citizen@test-admin-dashboard.com',
      passwordHash: 'test-password-hash',
      role: 'citizen',
    });
    citizenId = citizen._id.toString();
    citizenToken = signToken({ userId: citizenId, role: 'citizen' });

    const admin = await User.create({
      name: 'Dashboard Reviewer',
      email: 'reviewer@test-admin-dashboard.com',
      passwordHash: 'test-password-hash',
      role: 'admin',
    });
    adminId = admin._id.toString();
    adminToken = signToken({ userId: adminId, role: 'admin' });
  });

  afterAll(async () => {
    await Report.deleteMany({ title: /^\[TEST-P8\]/ });
    await User.deleteMany({ email: /@test-admin-dashboard\.com$/ });
    await disconnectDatabase();
  });

  async function createReport(overrides: Record<string, unknown> = {}) {
    const suffix = `${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
    return Report.create({
      reportNumber: `CB-P8${suffix}`,
      createdBy: citizenId,
      title: `[TEST-P8] Reviewer workflow ${suffix}`,
      description: 'A damaged public road needs review by a civic services team.',
      category: 'road_damage',
      status: 'submitted',
      priority: 'normal',
      statusHistory: [
        {
          fromStatus: null,
          toStatus: 'submitted',
          changedBy: citizenId,
          note: 'Initial report submission by citizen',
        },
      ],
      isDemoData: false,
      ...overrides,
    });
  }

  const asAdmin = (method: 'get' | 'patch', url: string) => {
    const req = request(app)[method](url);
    return req.set('Cookie', [`${SESSION_COOKIE_NAME}=${adminToken}`]);
  };

  it('restricts reviewer queue access to authenticated admins', async () => {
    const anonymous = await request(app).get('/api/admin/reports');
    const citizen = await request(app)
      .get('/api/admin/reports')
      .set('Cookie', [`${SESSION_COOKIE_NAME}=${citizenToken}`]);

    expect(anonymous.status).toBe(401);
    expect(citizen.status).toBe(403);
  });

  it('lists active real reports, returns status counts, and supports filters', async () => {
    const activeReport = await createReport();
    await createReport({ category: 'streetlight', status: 'under_review' });
    await createReport({ status: 'resolved' });
    await createReport({ isDemoData: true });

    const response = await asAdmin('get', '/api/admin/reports?category=road_damage&limit=1');

    expect(response.status).toBe(200);
    expect(response.body.reports).toHaveLength(1);
    expect(response.body.reports[0]._id).toBe(activeReport._id.toString());
    expect(response.body.pagination).toMatchObject({ total: 1, page: 1, limit: 1 });
    expect(response.body.summary).toMatchObject({
      submitted: 1,
      under_review: 1,
      resolved: 1,
    });
    expect(response.body.reports[0].createdBy.name).toBe('Dashboard Citizen');

    const statusFilter = await asAdmin('get', '/api/admin/reports?status=under_review');
    expect(statusFilter.body.reports).toHaveLength(1);
    expect(statusFilter.body.reports[0].status).toBe('under_review');

    const invalidFilter = await asAdmin('get', '/api/admin/reports?status=closed');
    expect(invalidFilter.status).toBe(422);
  });

  it('applies only allowed transitions and requires resolution/rejection notes', async () => {
    const report = await createReport();
    const unauthenticated = await request(app).patch(
      `/api/admin/reports/${report.reportNumber}/status`,
    );
    const invalidTransition = await asAdmin(
      'patch',
      `/api/admin/reports/${report.reportNumber}/status`,
    ).send({ status: 'in_progress' });
    const toReview = await asAdmin(
      'patch',
      `/api/admin/reports/${report.reportNumber}/status`,
    ).send({ status: 'under_review' });
    const missingResolutionNote = await asAdmin(
      'patch',
      `/api/admin/reports/${report.reportNumber}/status`,
    ).send({ status: 'resolved' });
    const toProgress = await asAdmin(
      'patch',
      `/api/admin/reports/${report.reportNumber}/status`,
    ).send({ status: 'in_progress' });
    const missingNote = await asAdmin(
      'patch',
      `/api/admin/reports/${report.reportNumber}/status`,
    ).send({ status: 'resolved' });
    const resolved = await asAdmin(
      'patch',
      `/api/admin/reports/${report.reportNumber}/status`,
    ).send({
      status: 'resolved',
      note: 'The reviewer reports that repairs are complete.',
    });

    expect(unauthenticated.status).toBe(401);
    expect(invalidTransition.status).toBe(422);
    expect(toReview.body.report.status).toBe('under_review');
    expect(toReview.body.report.statusHistory.at(-1)).toMatchObject({
      fromStatus: 'submitted',
      toStatus: 'under_review',
      changedBy: adminId,
    });
    expect(missingResolutionNote.status).toBe(422);
    expect(toProgress.body.report.status).toBe('in_progress');
    expect(missingNote.status).toBe(422);
    expect(resolved.status).toBe(200);
    expect(resolved.body.report.resolutionNote).toBe(
      'The reviewer reports that repairs are complete.',
    );
    expect(resolved.body.report.statusHistory.at(-1).toStatus).toBe('resolved');

    const terminalTransition = await asAdmin(
      'patch',
      `/api/admin/reports/${report.reportNumber}/status`,
    ).send({ status: 'under_review' });
    expect(terminalTransition.status).toBe(422);
  });

  it('requires a rejection reason and records reviewer priority audit changes', async () => {
    const report = await createReport();
    const missingRejectionReason = await asAdmin(
      'patch',
      `/api/admin/reports/${report.reportNumber}/status`,
    ).send({ status: 'rejected' });
    const rejected = await asAdmin(
      'patch',
      `/api/admin/reports/${report.reportNumber}/status`,
    ).send({
      status: 'rejected',
      note: 'This report is outside the public service scope.',
    });
    const priority = await asAdmin(
      'patch',
      `/api/admin/reports/${report.reportNumber}/priority`,
    ).send({ priority: 'high', note: 'Reviewer confirmed this needs prompt attention.' });
    const unchangedPriority = await asAdmin(
      'patch',
      `/api/admin/reports/${report.reportNumber}/priority`,
    ).send({ priority: 'high' });

    expect(missingRejectionReason.status).toBe(422);
    expect(rejected.status).toBe(200);
    expect(rejected.body.report.rejectionReason).toBe(
      'This report is outside the public service scope.',
    );
    expect(priority.status).toBe(200);
    expect(priority.body.report.priorityHistory).toHaveLength(1);
    expect(priority.body.report.priorityHistory[0]).toMatchObject({
      fromPriority: 'normal',
      toPriority: 'high',
      changedBy: adminId,
      note: 'Reviewer confirmed this needs prompt attention.',
    });
    expect(unchangedPriority.body.report.priorityHistory).toHaveLength(1);
  });
});
