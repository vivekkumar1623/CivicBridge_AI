import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { api } from '../lib/api';
import {
  CATEGORY_LABELS,
  Category,
  Priority,
  Report,
  STATUS_COLORS,
  STATUS_LABELS,
  Status,
} from '../types';

interface AdminDashboardResponse {
  reports: Report[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  summary: Record<Status, number>;
}

const STATUSES: Status[] = ['submitted', 'under_review', 'in_progress', 'resolved', 'rejected'];
const CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[];
const PRIORITIES: Priority[] = ['low', 'normal', 'high'];
const ALLOWED_NEXT_STATUS: Record<Status, Status[]> = {
  submitted: ['under_review', 'rejected'],
  under_review: ['in_progress', 'rejected'],
  in_progress: ['resolved', 'rejected'],
  resolved: [],
  rejected: [],
};

export const AdminDashboardPage: React.FC = () => {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [data, setData] = useState<AdminDashboardResponse | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: page.toString(), limit: '20' });
    if (statusFilter) params.set('status', statusFilter);
    if (categoryFilter) params.set('category', categoryFilter);
    if (priorityFilter) params.set('priority', priorityFilter);

    try {
      const response = await api.get<AdminDashboardResponse>(`/admin/reports?${params.toString()}`);
      setData(response.data);
    } catch (requestError: any) {
      setError(requestError.response?.data?.error ?? 'Could not load the reviewer dashboard.');
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter, categoryFilter, priorityFilter]);

  useEffect(() => {
    if (user?.role === 'admin') {
      void loadDashboard();
    }
  }, [user, loadDashboard]);

  if (isAuthLoading) {
    return <p className="py-20 text-center text-sm text-slate-500">Checking access...</p>;
  }

  if (user?.role !== 'admin') {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-slate-900">Reviewer access required</h1>
        <p className="text-sm text-slate-600">
          Sign in with an authorized reviewer account to view and manage reports.
        </p>
        <Link
          to="/login"
          className="inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Sign in
        </Link>
      </div>
    );
  }

  const resetFilters = () => {
    setPage(1);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Reviewer dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">
          Review active reports, apply only permitted status transitions, and record reviewer
          priority decisions. Counts exclude demo records.
        </p>
      </header>

      {data && (
        <section
          aria-label="Report totals by status"
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
        >
          {STATUSES.map((status) => (
            <div key={status} className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium text-slate-500">{STATUS_LABELS[status]}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{data.summary[status] ?? 0}</p>
              <p className="text-[11px] text-slate-500">non-demo reports</p>
            </div>
          ))}
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-semibold text-slate-700">
            Status
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                resetFilters();
              }}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
            >
              <option value="">All active statuses</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-700">
            Category
            <select
              value={categoryFilter}
              onChange={(event) => {
                setCategoryFilter(event.target.value);
                resetFilters();
              }}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
            >
              <option value="">All categories</option>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-700">
            Review priority
            <select
              value={priorityFilter}
              onChange={(event) => {
                setPriorityFilter(event.target.value);
                resetFilters();
              }}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
            >
              <option value="">All priorities</option>
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority[0].toUpperCase() + priority.slice(1)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
        >
          {error}
          <button
            type="button"
            onClick={() => void loadDashboard()}
            className="ml-3 font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}

      {isLoading ? (
        <p role="status" aria-live="polite" className="py-12 text-center text-sm text-slate-500">
          Loading reviewer queue...
        </p>
      ) : !error && data?.reports.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-600">
          No reports match these filters.
        </div>
      ) : (
        <div className="space-y-4">
          {data?.reports.map((report) => (
            <ReviewerReportCard key={report._id} report={report} onUpdated={loadDashboard} />
          ))}
        </div>
      )}

      {data && data.pagination.totalPages > 1 && (
        <nav aria-label="Reviewer queue pages" className="flex items-center justify-between">
          <button
            type="button"
            disabled={page <= 1 || isLoading}
            onClick={() => setPage((current) => current - 1)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs text-slate-600">
            Page {data.pagination.page} of {data.pagination.totalPages} · {data.pagination.total}{' '}
            reports
          </span>
          <button
            type="button"
            disabled={page >= data.pagination.totalPages || isLoading}
            onClick={() => setPage((current) => current + 1)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-40"
          >
            Next
          </button>
        </nav>
      )}
    </div>
  );
};

interface ReviewerReportCardProps {
  report: Report;
  onUpdated: () => Promise<void>;
}

const ReviewerReportCard: React.FC<ReviewerReportCardProps> = ({ report, onUpdated }) => {
  const [nextStatus, setNextStatus] = useState<Status>(
    ALLOWED_NEXT_STATUS[report.status][0] ?? report.status,
  );
  const [statusNote, setStatusNote] = useState('');
  const [priority, setPriority] = useState<Priority>(report.priority);
  const [priorityNote, setPriorityNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const possibleNextStatuses = ALLOWED_NEXT_STATUS[report.status];
  const statusColor = STATUS_COLORS[report.status];
  const createdBy = typeof report.createdBy === 'string' ? null : report.createdBy;

  const updateStatus = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      await api.patch(`/admin/reports/${report.reportNumber}/status`, {
        status: nextStatus,
        ...(statusNote.trim() ? { note: statusNote.trim() } : {}),
      });
      setStatusNote('');
      await onUpdated();
    } catch (requestError: any) {
      setError(requestError.response?.data?.error ?? 'Unable to update report status.');
    } finally {
      setIsSaving(false);
    }
  };

  const updatePriority = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      await api.patch(`/admin/reports/${report.reportNumber}/priority`, {
        priority,
        ...(priorityNote.trim() ? { note: priorityNote.trim() } : {}),
      });
      setPriorityNote('');
      await onUpdated();
    } catch (requestError: any) {
      setError(requestError.response?.data?.error ?? 'Unable to update report priority.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <article
      aria-busy={isSaving}
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-col justify-between gap-3 sm:flex-row">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 font-mono text-xs font-bold text-blue-800">
              {report.reportNumber}
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusColor.bg} ${statusColor.text} ${statusColor.border}`}
            >
              {STATUS_LABELS[report.status]}
            </span>
            <span className="text-xs text-slate-500">
              {CATEGORY_LABELS[report.category]} · {report.priority} priority
            </span>
          </div>
          <h2 id={`report-title-${report._id}`} className="text-lg font-semibold text-slate-900">
            {report.title}
          </h2>
          <p className="whitespace-pre-wrap text-sm text-slate-700">{report.description}</p>
          <p className="text-xs text-slate-500">
            Submitted by {createdBy?.name ?? 'Unknown reporter'} ·{' '}
            {new Date(report.createdAt).toLocaleString()}
            {report.locationLabel ? ` · ${report.locationLabel}` : ''}
          </p>
        </div>
        <Link
          to={`/reports/${report.reportNumber}`}
          className="h-fit whitespace-nowrap rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100"
        >
          Full report
        </Link>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800">
          {error}
        </p>
      )}

      <div className="grid gap-4 border-t border-slate-100 pt-4 lg:grid-cols-2">
        <form
          onSubmit={updateStatus}
          aria-labelledby={`status-heading-${report._id}`}
          className="space-y-2"
        >
          <h3
            id={`status-heading-${report._id}`}
            className="text-xs font-semibold uppercase tracking-wide text-slate-600"
          >
            Update report status
          </h3>
          {possibleNextStatuses.length > 0 ? (
            <>
              <div className="flex gap-2">
                <label className="sr-only" htmlFor={`status-${report._id}`}>
                  Next status
                </label>
                <select
                  id={`status-${report._id}`}
                  value={nextStatus}
                  onChange={(event) => setNextStatus(event.target.value as Status)}
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {possibleNextStatuses.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={
                    isSaving ||
                    (['resolved', 'rejected'].includes(nextStatus) && statusNote.trim().length < 10)
                  }
                  className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Save
                </button>
              </div>
              {['resolved', 'rejected'].includes(nextStatus) && (
                <label className="block text-xs text-slate-600">
                  {nextStatus === 'resolved' ? 'Resolution note' : 'Rejection reason'} (10–500
                  characters)
                  <textarea
                    value={statusNote}
                    onChange={(event) => setStatusNote(event.target.value)}
                    required
                    minLength={10}
                    maxLength={500}
                    rows={2}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
              )}
            </>
          ) : (
            <p className="text-xs text-slate-500">This report has reached a final status.</p>
          )}
        </form>

        <form
          onSubmit={updatePriority}
          aria-labelledby={`priority-heading-${report._id}`}
          className="space-y-2"
        >
          <h3
            id={`priority-heading-${report._id}`}
            className="text-xs font-semibold uppercase tracking-wide text-slate-600"
          >
            Reviewer-assigned priority
          </h3>
          <div className="flex gap-2">
            <label className="sr-only" htmlFor={`priority-${report._id}`}>
              Priority
            </label>
            <select
              id={`priority-${report._id}`}
              value={priority}
              onChange={(event) => setPriority(event.target.value as Priority)}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {value[0].toUpperCase() + value.slice(1)}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={isSaving || priority === report.priority}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
            >
              Save priority
            </button>
          </div>
          {priority !== report.priority && (
            <label className="block text-xs text-slate-600">
              Audit note (optional)
              <input
                value={priorityNote}
                onChange={(event) => setPriorityNote(event.target.value)}
                maxLength={500}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          )}
        </form>
      </div>
    </article>
  );
};
