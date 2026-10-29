import axios from 'axios';
import { z } from 'zod';
import { config } from '../config/index.js';
import { CATEGORY_VALUES, Category } from '../models/enums.js';

const categorySuggestionResponseSchema = z
  .object({
    suggestedCategory: z.enum(CATEGORY_VALUES).nullable(),
    confidence: z.number().min(0).max(1),
    modelVersion: z.string().nullable(),
    needsHumanReview: z.boolean(),
  })
  .strict();

export interface CategorySuggestion {
  suggestedCategory: Category | null;
  confidence: number;
  modelVersion: string | null;
  needsHumanReview: boolean;
  suggestionsUnavailable: boolean;
  message?: string;
}

const unavailableSuggestion: CategorySuggestion = {
  suggestedCategory: null,
  confidence: 0,
  modelVersion: null,
  needsHumanReview: true,
  suggestionsUnavailable: true,
  message: 'Category suggestions are temporarily unavailable; choose a category manually.',
};

export async function getCategorySuggestion(
  description: string,
): Promise<CategorySuggestion> {
  try {
    const response = await axios.post<unknown>(
      `${config.mlServiceUrl}/predict-category`,
      { description },
      { timeout: config.mlServiceTimeoutMs },
    );
    const parsed = categorySuggestionResponseSchema.safeParse(response.data);

    if (!parsed.success) {
      console.error('[ML] Category service returned an invalid response.');
      return unavailableSuggestion;
    }

    return { ...parsed.data, suggestionsUnavailable: false };
  } catch (error) {
    const reason = axios.isAxiosError(error) ? error.code ?? error.message : 'unexpected error';
    console.warn(`[ML] Category suggestion unavailable (${reason}).`);
    return unavailableSuggestion;
  }
}
