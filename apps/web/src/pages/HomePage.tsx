import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { CATEGORY_LABELS, Category } from '../types';

export const HomePage: React.FC = () => {
  const { user } = useAuth();

  const categories = Object.entries(CATEGORY_LABELS) as [Category, string][];

  return (
    <div className="space-y-16 py-8">
      {/* Hero Section */}
      <section className="text-center max-w-4xl mx-auto px-4 space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          <span>Campus & Community Pilot Prototype</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
          Human-Centred Civic Issue Reporting with{' '}
          <span className="text-blue-600">Transparent Triage</span>
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Report potholes, broken streetlights, water drainage faults, and public property hazards in your local area. Track progress in real time with an immutable status timeline.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <Link
            to="/reports/new"
            className="px-6 py-3 rounded-xl font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-md transition"
          >
            Report an Issue Now
          </Link>
          {user ? (
            <Link
              to="/reports/mine"
              className="px-6 py-3 rounded-xl font-semibold bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 shadow-sm transition"
            >
              View My Reports
            </Link>
          ) : (
            <Link
              to="/register"
              className="px-6 py-3 rounded-xl font-semibold bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 shadow-sm transition"
            >
              Create Citizen Account
            </Link>
          )}
        </div>
      </section>

      {/* 3 Steps Guide */}
      <section className="max-w-6xl mx-auto px-4">
        <h2 className="text-2xl font-bold text-slate-900 text-center mb-10">
          How CivicBridge AI Works
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg">
              1
            </div>
            <h3 className="font-semibold text-lg text-slate-900">Describe the Problem</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Tell us what is broken or damaged, pick a category, and optionally attach a photo or your location.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-lg">
              2
            </div>
            <h3 className="font-semibold text-lg text-slate-900">AI Suggests, You Decide</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Our ML model assists with category suggestions and flags nearby duplicates, but you stay in full control.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg">
              3
            </div>
            <h3 className="font-semibold text-lg text-slate-900">Transparent Resolution</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Track your report through review, in-progress, and resolution. Reviewers must provide detailed transition notes.
            </p>
          </div>
        </div>
      </section>

      {/* Supported Categories */}
      <section className="max-w-6xl mx-auto px-4">
        <div className="bg-slate-50 border border-slate-200 rounded-3xl p-8 sm:p-10 space-y-6">
          <h2 className="text-xl font-bold text-slate-900">
            Covered Public Issue Categories
          </h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {categories.map(([key, label]) => (
              <div
                key={key}
                className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-3"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span className="text-sm font-medium text-slate-800">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
