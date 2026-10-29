import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { api } from '../lib/api';
import {
  CATEGORY_LABELS,
  Category,
  CategorySuggestion,
  DuplicateSuggestionsResponse,
  Report,
  STATUS_LABELS,
} from '../types';

export const NewReportPage: React.FC = () => {
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Category>('road_damage');
  const [description, setDescription] = useState('');
  const [locationLabel, setLocationLabel] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [categorySuggestion, setCategorySuggestion] = useState<CategorySuggestion | null>(null);
  const [isSuggestingCategory, setIsSuggestingCategory] = useState(false);
  const [categorySuggestionMessage, setCategorySuggestionMessage] = useState<string | null>(null);
  const [duplicateSuggestions, setDuplicateSuggestions] =
    useState<DuplicateSuggestionsResponse | null>(null);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const duplicateRequestId = useRef(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedReport, setSubmittedReport] = useState<Report | null>(null);

  const categories = Object.entries(CATEGORY_LABELS) as [Category, string][];
  const suggestedCategory = categorySuggestion?.suggestedCategory;

  const clearDuplicateSuggestions = () => {
    duplicateRequestId.current += 1;
    setDuplicateSuggestions(null);
    setIsCheckingDuplicates(false);
  };

  // Geolocation capture
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus('Geolocation is not supported by your browser.');
      return;
    }

    setGeoStatus('Locating your position...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearDuplicateSuggestions();
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setGeoStatus('Coordinates captured successfully!');
      },
      (err) => {
        setGeoStatus(
          err.code === 1
            ? 'Location permission denied. You can still continue without coordinates.'
            : 'Unable to retrieve location. You can continue without coordinates.',
        );
      },
      { timeout: 10000 },
    );
  };

  const handleClearLocation = () => {
    clearDuplicateSuggestions();
    setCoords(null);
    setGeoStatus(null);
  };

  const handleCheckDuplicates = async () => {
    if (!coords || description.trim().length < 20) {
      return;
    }

    const requestId = ++duplicateRequestId.current;
    setIsCheckingDuplicates(true);
    setDuplicateSuggestions(null);
    try {
      const response = await api.post<DuplicateSuggestionsResponse>(
        '/reports/duplicate-suggestions',
        {
          description: description.trim(),
          category,
          latitude: coords.lat,
          longitude: coords.lng,
        },
      );
      if (requestId === duplicateRequestId.current) {
        setDuplicateSuggestions(response.data);
      }
    } catch {
      if (requestId === duplicateRequestId.current) {
        setDuplicateSuggestions({
          matches: [],
          suggestionsUnavailable: true,
          message: 'Nearby duplicate checking is unavailable. You can still submit your report.',
        });
      }
    } finally {
      if (requestId === duplicateRequestId.current) {
        setIsCheckingDuplicates(false);
      }
    }
  };

  const handleSuggestCategory = async () => {
    if (description.trim().length < 20) {
      setCategorySuggestionMessage('Enter at least 20 characters before requesting a suggestion.');
      return;
    }

    setIsSuggestingCategory(true);
    setCategorySuggestion(null);
    setCategorySuggestionMessage(null);
    try {
      const response = await api.post<CategorySuggestion>('/ai/category-suggestion', {
        description: description.trim(),
      });
      setCategorySuggestion(response.data);
      if (response.data.suggestionsUnavailable) {
        setCategorySuggestionMessage(
          response.data.message ?? 'Suggestions are unavailable; choose a category manually.',
        );
      } else if (!response.data.suggestedCategory) {
        setCategorySuggestionMessage('No clear suggestion is available. Please choose manually.');
      }
    } catch {
      setCategorySuggestionMessage(
        'Suggestions are temporarily unavailable; choose a category manually.',
      );
    } finally {
      setIsSuggestingCategory(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (description.trim().length < 20) {
      setError('Description must be at least 20 characters long.');
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      formData.append('category', category);

      if (locationLabel.trim()) {
        formData.append('locationLabel', locationLabel.trim());
      }

      if (coords) {
        formData.append('latitude', coords.lat.toString());
        formData.append('longitude', coords.lng.toString());
      }

      if (selectedFile) {
        formData.append('photo', selectedFile);
      }

      const res = await api.post('/reports', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setSubmittedReport(res.data.report);
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          err.response?.data?.details?.[0]?.message ||
          'Failed to submit report. Please review your input.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // If user is not logged in, prompt to sign in
  if (!user) {
    return (
      <div className="max-w-lg mx-auto py-16 px-4 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto text-2xl font-bold">
          !
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Sign In Required</h1>
        <p className="text-slate-600 text-sm">
          You must be logged in as a registered citizen to report an issue and track its resolution
          history.
        </p>
        <div className="flex justify-center gap-3">
          <Link
            to="/login"
            className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-blue-600 text-white hover:bg-blue-700 transition"
          >
            Sign In
          </Link>
          <Link
            to="/register"
            className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition"
          >
            Create Account
          </Link>
        </div>
      </div>
    );
  }

  // Submission success view
  if (submittedReport) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4">
        <div className="bg-white p-8 rounded-2xl border border-emerald-200 shadow-sm text-center space-y-6">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto text-2xl font-bold">
            âœ“
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-slate-900">Report Submitted Successfully</h1>
            <p className="text-sm text-slate-500">
              Your public issue report has been recorded and entered into the triage queue.
            </p>
          </div>


          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-left">
            <div className="flex justify-between items-center text-sm border-b border-slate-200 pb-2">
              <span className="text-slate-500">Report Number:</span>
              <span className="font-mono font-bold text-blue-700 text-base">
                {submittedReport.reportNumber}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm border-b border-slate-200 pb-2">
              <span className="text-slate-500">Category:</span>
              <span className="font-medium text-slate-900">
                {CATEGORY_LABELS[submittedReport.category]}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Initial Status:</span>
              <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 capitalize">
                {submittedReport.status}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link
              to={`/reports/${submittedReport.reportNumber}`}
              className="flex-1 py-2.5 px-4 rounded-xl font-semibold text-sm bg-blue-600 text-white hover:bg-blue-700 transition"
            >
              Track Report Details
            </Link>
            <button
              onClick={() => {
                setSubmittedReport(null);
                setTitle('');
                setDescription('');
                setLocationLabel('');
                setCoords(null);
                setSelectedFile(null);
                clearDuplicateSuggestions();
              }}
              className="flex-1 py-2.5 px-4 rounded-xl font-semibold text-sm bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
            >
              Submit Another Report
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6">
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Report a Civic Problem</h1>
          <p className="text-sm text-slate-500 mt-1">
            Provide details of the problem so the review team can assess and triage it.
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Issue Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              minLength={5}
              maxLength={100}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Deep pothole on Campus North Entrance road"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition"
            />
            <p className="text-[11px] text-slate-500 mt-1">Between 5 and 100 characters</p>
          </div>

          {/* Category Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Issue Category <span className="text-rose-500">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value as Category);
                clearDuplicateSuggestions();
              }}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition bg-white"
            >
              {categories.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleSuggestCategory}
                disabled={isSuggestingCategory || description.trim().length < 20}
                className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSuggestingCategory ? 'Checking description...' : 'Suggest category'}
              </button>
              {suggestedCategory && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-slate-600">
                    Suggested category: {CATEGORY_LABELS[suggestedCategory]}. Please check this
                    suggestion.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setCategory(suggestedCategory);
                      clearDuplicateSuggestions();
                    }}
                    className="font-semibold text-blue-700 underline underline-offset-2"
                  >
                    Use suggestion
                  </button>
                </div>
              )}
            </div>
            {categorySuggestionMessage && (
              <p className="mt-2 text-sm text-slate-600">
                {categorySuggestionMessage}
              </p>
            )}
          </div>

                    {/* Description */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Detailed Description <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-500">
                {description.length} / 2000 chars (min 20)
              </span>
            </div>
            <textarea
              required
              rows={4}
              minLength={20}
              maxLength={2000}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setCategorySuggestion(null);
                setCategorySuggestionMessage(null);
                clearDuplicateSuggestions();
              }}
              placeholder="Describe the issue clearly: what is broken, where exactly it is, and what safety or functional risks it causes..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition resize-y"
            />
          </div>

          {/* Location Section */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-800 uppercase tracking-wider block">
                  Location (Optional)
                </span>
                <span className="text-xs text-slate-500">
                  Adding GPS coordinates helps prevent duplicate reports.
                </span>
              </div>
              {!coords ? (
                <button
                  type="button"
                  onClick={handleGetLocation}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition"
                >
                  Use my current location
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleClearLocation}
                  className="px-2.5 py-1 rounded text-xs font-medium text-rose-600 hover:bg-rose-50 transition"
                >
                  Clear GPS
                </button>
              )}
            </div>

            {geoStatus && <p className="text-xs text-slate-600 italic">{geoStatus}</p>}

            {coords && (
              <div className="text-xs text-emerald-800 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 flex items-center justify-between">
                <span>
                  Captured GPS: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                </span>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                Landmark or Location Label (Optional)
              </label>
              <input
                type="text"
                maxLength={120}
                value={locationLabel}
                onChange={(e) => setLocationLabel(e.target.value)}
                placeholder="e.g. Opposite Main Canteen / Gate No. 2"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs bg-white"
              />
            </div>
          </div>

          <section
            className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
          >
            <div>
              <h2 id="duplicate-check-heading" className="text-sm font-semibold text-slate-800">
                Check for nearby reports
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                With your location, CivicBridge checks active reports within 500 m. Other
                reporters&apos; titles, descriptions, photos, and identities are not shown.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCheckDuplicates}
              disabled={!coords || description.trim().length < 20 || isCheckingDuplicates}
              className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCheckingDuplicates ? 'Checking nearby reports...' : 'Check for similar reports'}
            </button>
            {!coords && (
              <p className="text-xs text-slate-500">
                Nearby matching needs optional GPS coordinates. You can still submit without GPS.
              </p>
            )}
            {duplicateSuggestions && (
              <div className="space-y-2">
                {duplicateSuggestions.matches.length > 0 ? (
                  <>
                    <p className="text-xs text-amber-900">
                      These are possible matches, not confirmed duplicates. Nothing is merged or
                      hidden automatically.
                    </p>
                    <ul className="space-y-2">
                      {duplicateSuggestions.matches.map((match, index) => (
                        <li
                          key={`${match.category}-${match.status}-${match.distanceBand}-${index}`}
                          className="flex flex-wrap gap-x-3 gap-y-1 rounded-lg bg-slate-50 p-3 text-xs text-slate-700"
                        >
                          <span className="font-semibold">{CATEGORY_LABELS[match.category]}</span>
                          <span>{STATUS_LABELS[match.status]}</span>
                          <span>
                            {match.distanceBand === 'within_250m'
                              ? 'Within 250 m'
                              : '250–500 m away'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="text-xs text-slate-600">
                    {duplicateSuggestions.message ??
                      (duplicateSuggestions.suggestionsUnavailable
                        ? 'Nearby duplicate checking is unavailable. You can still submit your report.'
                        : 'No similar nearby reports were found. You can submit your report.')}
                  </p>
                )}
              </div>
            )}
          </section>

          {/* Optional Photo Attachment */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Attach Photo (Optional, Max 5 MB)
            </label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                setSelectedFile(e.target.files?.[0] ?? null);
              }}
              className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
            />
            <p className="text-[11px] text-slate-400">
              Only JPEG, PNG, or WebP format. EXIF/GPS metadata is automatically stripped on upload
              for privacy.
            </p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-4 rounded-xl font-semibold text-sm bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting Report...' : 'Submit Report'}
          </button>
        </form>
      </div>
    </div>
  );
};
