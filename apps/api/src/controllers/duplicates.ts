import { Request, Response } from 'express';
import { duplicateSuggestionRequestSchema } from '../validators/index.js';
import { findNearbyDuplicateSuggestions } from '../services/duplicateSuggestion.js';

export async function getDuplicateSuggestions(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const parsed = duplicateSuggestionRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({
      error: 'Validation failed',
      details: parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    });
    return;
  }

  try {
    res.json(await findNearbyDuplicateSuggestions(parsed.data));
  } catch (error) {
    console.error('[DUPLICATES] Nearby report lookup failed:', (error as Error).message);
    res.status(503).json({
      error: 'Nearby duplicate checking is temporarily unavailable',
      suggestionsUnavailable: true,
    });
  }
}
