import { Request, Response } from 'express';
import { categorySuggestionRequestSchema } from '../validators/index.js';
import { getCategorySuggestion } from '../services/categorySuggestion.js';

export async function suggestCategory(req: Request, res: Response): Promise<void> {
  const parsed = categorySuggestionRequestSchema.safeParse(req.body);
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

  const suggestion = await getCategorySuggestion(parsed.data.description);
  res.json(suggestion);
}
