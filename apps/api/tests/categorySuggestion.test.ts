import { afterEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { config } from '../src/config/index.js';
import { getCategorySuggestion } from '../src/services/categorySuggestion.js';

describe('Category suggestion service', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a validated model prediction', async () => {
    const post = vi.spyOn(axios, 'post').mockResolvedValue({
      data: {
        suggestedCategory: 'streetlight',
        confidence: 0.8,
        modelVersion: 'tfidf-logreg-v1',
        needsHumanReview: false,
      },
    });

    const result = await getCategorySuggestion('A streetlight is broken near the library.');

    expect(result).toEqual({
      suggestedCategory: 'streetlight',
      confidence: 0.8,
      modelVersion: 'tfidf-logreg-v1',
      needsHumanReview: false,
      suggestionsUnavailable: false,
    });
    expect(post).toHaveBeenCalledWith(
      `${config.mlServiceUrl}/predict-category`,
      { description: 'A streetlight is broken near the library.' },
      { timeout: config.mlServiceTimeoutMs },
    );
  });

  it('returns an explicit manual-selection fallback when the ML service is offline', async () => {
    vi.spyOn(axios, 'post').mockRejectedValue(new Error('connection refused'));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const result = await getCategorySuggestion('A streetlight is broken near the library.');

    expect(result.suggestedCategory).toBeNull();
    expect(result.suggestionsUnavailable).toBe(true);
    expect(result.needsHumanReview).toBe(true);
    expect(result.message).toMatch(/choose a category manually/i);
  });

  it('does not pass an invalid model response through to the API', async () => {
    vi.spyOn(axios, 'post').mockResolvedValue({
      data: {
        suggestedCategory: 'unlisted_category',
        confidence: 1.5,
        modelVersion: 'invalid',
        needsHumanReview: false,
      },
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await getCategorySuggestion('A streetlight is broken near the library.');

    expect(result.suggestedCategory).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.suggestionsUnavailable).toBe(true);
  });
});
