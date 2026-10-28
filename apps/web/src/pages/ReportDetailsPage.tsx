import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Report, CATEGORY_LABELS, STATUS_LABELS, STATUS_COLORS } from '../types';

export const ReportDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await api.get(`/reports/${id}`);
        setReport(res.data.report);
      } catch (err: any) {
        setError(
          err.response?.data?.error || 'Failed to load report details or access denied.'
        );
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchReport();
    }
  }, [id]);

  if (isLoading) {
    return (
      <div className="py-20 text-center text-slate-400 text-sm">
        Loading report details...
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center space-y-4">
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
          {error || 'Report not found.'}
        </div>
        <Link
          to="/reports/mine"
          className="inline-block px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white"
        >
          ← Back to My Reports
        </Link>
      </div>
    );
  }

  const statusConfig = STATUS_COLORS[report.status] || {
    bg: 'bg-slate-100',
    text: 'text-slate-800',
    border: 'border-slate-200',
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      {/* Back button */}
      <div>
        <Link
          to="/reports/mine"
          className="text-xs font-semibold text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 transition"
        >
          ← Back to My Reports
        </Link>
      </div>

      {/* Main Report Card */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="space-y-3 border-b border-slate-200 pb-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="font-mono text-sm font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded border border-blue-200">
              {report.reportNumber}
            </span>
            <span
              className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
            >
              {STATUS_LABELS[report.status]}
            </span>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 leading-snug">
            {report.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
            <span>
              Category: <strong>{CATEGORY_LABELS[report.category]}</strong>
            </span>
            <span>•</span>
            <span>
              Priority: <strong className="capitalize">{report.priority}</strong>
            </span>
            <span>•</span>
            <span>
              Reported on{' '}
              {new Date(report.createdAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <h2 className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
            Issue Description
          </h2>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
            {report.description}
          </p>
        </div>

        {/* Location Info if present */}
        {(report.location || report.locationLabel) && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
            <h2 className="text-xs font-semibold uppercase text-slate-700 tracking-wider">
              Location Details
            </h2>
            {report.locationLabel && (
              <p className="text-xs text-slate-700">
                Landmark: <span className="font-medium">{report.locationLabel}</span>
              </p>
            )}
            {report.location && (
              <p className="text-xs text-slate-500 font-mono">
                Coordinates: {report.location.coordinates[1].toFixed(5)}° N, {report.location.coordinates[0].toFixed(5)}° E
              </p>
            )}
          </div>
        )}

        {/* Photo preview if present */}
        {report.photoKey && (
          <div className="space-y-2">
            <h2 className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
              Attached Photo
            </h2>
            <div className="rounded-xl overflow-hidden border border-slate-200 max-w-md bg-slate-100">
              <img
                src={`/api/reports/${report.reportNumber}/photo`}
                alt="Reported issue attachment"
                className="w-full h-auto max-h-72 object-cover"
                loading="lazy"
              />
            </div>
          </div>
        )}

        {/* Resolution note if present */}
        {report.resolutionNote && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1">
            <h2 className="text-xs font-semibold uppercase text-emerald-800 tracking-wider">
              Reviewer Resolution Note
            </h2>
            <p className="text-xs text-emerald-900 leading-relaxed">
              {report.resolutionNote}
            </p>
            <p className="text-[11px] text-emerald-700 pt-1 italic">
              Note: This is the status update provided by the triage reviewer, not independently verified ground truth.
            </p>
          </div>
        )}

        {/* Status History Timeline */}
        <div className="space-y-4 pt-4 border-t border-slate-200">
          <h2 className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
            Status Audit Timeline ({report.statusHistory.length} updates)
          </h2>

          <div className="space-y-3">
            {report.statusHistory.map((item, index) => (
              <div
                key={index}
                className="flex items-start gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200/80"
              >
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                <div className="space-y-1 flex-1">
                  <div className="flex justify-between items-center flex-wrap gap-1">
                    <span className="font-semibold text-slate-800 capitalize">
                      {item.fromStatus ? `${item.fromStatus} → ` : ''}{item.toStatus}
                    </span>
                    <span className="text-slate-400 text-[11px]">
                      {new Date(item.changedAt).toLocaleString()}
                    </span>
                  </div>
                  {item.note && (
                    <p className="text-slate-600 bg-white p-2 rounded border border-slate-200/60 mt-1">
                      {item.note}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
