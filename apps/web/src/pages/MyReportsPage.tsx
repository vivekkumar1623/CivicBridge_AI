import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { api } from '../lib/api';
import { Report, CATEGORY_LABELS, STATUS_LABELS, STATUS_COLORS } from '../types';

export const MyReportsPage: React.FC = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = async (pageNumber: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get(`/reports/mine?page=${pageNumber}&limit=10`);
      setReports(res.data.reports);
      setPage(res.data.pagination.page);
      setTotalPages(res.data.pagination.totalPages);
      setTotal(res.data.pagination.total);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load reports.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchReports(page);
    }
  }, [user, page]);

  if (!user) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <h1 className="text-xl font-bold text-slate-900">Sign in to view your reports</h1>
        <Link
          to="/login"
          className="inline-block px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white"
        >
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Issue Reports</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track and view status updates for problems you reported ({total} total)
          </p>
        </div>
        <Link
          to="/reports/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition self-start sm:self-auto"
        >
          <span>+ Report New Issue</span>
        </Link>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="py-20 text-center text-slate-400 text-sm">
          Loading your reports...
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto text-xl font-bold">
            ?
          </div>
          <h2 className="text-lg font-semibold text-slate-800">No reports submitted yet</h2>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            Notice a pothole, broken light, or public space problem? Submit your first report to get started.
          </p>
          <Link
            to="/reports/new"
            className="inline-block px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition"
          >
            Submit an Issue
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const statusConfig = STATUS_COLORS[report.status] || {
              bg: 'bg-slate-100',
              text: 'text-slate-800',
              border: 'border-slate-200',
            };

            return (
              <div
                key={report._id}
                className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-slate-300 shadow-xs transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {report.reportNumber}
                    </span>
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
                    >
                      {STATUS_LABELS[report.status]}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(report.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>

                  <h3 className="font-semibold text-slate-900 text-base truncate">
                    {report.title}
                  </h3>

                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>{CATEGORY_LABELS[report.category]}</span>
                    {report.locationLabel && (
                      <>
                        <span>•</span>
                        <span className="truncate max-w-xs">{report.locationLabel}</span>
                      </>
                    )}
                  </div>
                </div>

                <Link
                  to={`/reports/${report.reportNumber}`}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition text-center whitespace-nowrap self-start sm:self-auto"
                >
                  View Details →
                </Link>
              </div>
            );
          })}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center pt-4">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                ← Previous
              </button>
              <span className="text-xs text-slate-500">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
