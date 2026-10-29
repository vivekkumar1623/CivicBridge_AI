import axios from 'axios';
import { z } from 'zod';
import { config } from '../config/index.js';
import { Report } from '../models/Report.js';
import { Category, STATUS_VALUES, Status } from '../models/enums.js';
import { DuplicateSuggestionInput } from '../validators/index.js';

const SEARCH_RADIUS_METERS = 500;
const MAX_CANDIDATES = 50;

const duplicateScoreResponseSchema = z
  .object({
    scoredCandidates: z
      .array(
        z
          .object({
            id: z.string().min(1).max(100),
            textSimilarity: z.number().min(0).max(1),
            distanceMeters: z.number().min(0).max(SEARCH_RADIUS_METERS).nullable(),
            sameCategory: z.boolean(),
          })
          .strict(),
      )
      .max(5),
  })
  .strict();

export type DuplicateDistanceBand = 'within_250m' | '250m_to_500m';

export interface DuplicateMatchPreview {
  category: Category;
  status: Status;
  distanceBand: DuplicateDistanceBand;
}

export interface DuplicateSuggestionResult {
  matches: DuplicateMatchPreview[];
  suggestionsUnavailable: boolean;
  message?: string;
}

function calculateDistanceMeters(first: [number, number], second: [number, number]): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const [firstLongitude, firstLatitude] = first;
  const [secondLongitude, secondLatitude] = second;
  const latitudeDelta = radians(secondLatitude - firstLatitude);
  const longitudeDelta = radians(secondLongitude - firstLongitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(firstLatitude)) *
      Math.cos(radians(secondLatitude)) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 6_371_000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function unavailableResult(): DuplicateSuggestionResult {
  return {
    matches: [],
    suggestionsUnavailable: true,
    message: 'Nearby duplicate checking is unavailable. You can still submit your report.',
  };
}

export async function findNearbyDuplicateSuggestions(
  input: DuplicateSuggestionInput,
): Promise<DuplicateSuggestionResult> {
  const { description, category, latitude, longitude } = input;
  if (latitude === undefined || longitude === undefined) {
    return {
      matches: [],
      suggestionsUnavailable: false,
      message: 'Add a location to check for nearby reports. You can still submit without one.',
    };
  }

  const point = {
    type: 'Point' as const,
    coordinates: [longitude, latitude] as [number, number],
  };
  const reports = await Report.find({
    location: {
      $near: {
        $geometry: point,
        $maxDistance: SEARCH_RADIUS_METERS,
      },
    },
    status: {
      $in: STATUS_VALUES.filter(
        (status) => status === 'submitted' || status === 'under_review' || status === 'in_progress',
      ),
    },
    isDemoData: false,
  })
    .select('_id description category status location')
    .limit(MAX_CANDIDATES)
    .lean();

  const candidates = reports.flatMap((report) => {
    if (!report.location) {
      return [];
    }

    return [
      {
        id: report._id.toString(),
        description: report.description,
        category: report.category,
        status: report.status,
        distanceMeters: calculateDistanceMeters(point.coordinates, report.location.coordinates),
      },
    ];
  });
  if (candidates.length === 0) {
    return {
      matches: [],
      suggestionsUnavailable: false,
      message: 'No active reports were found within 500 m. You can submit your report.',
    };
  }

  let responseData: unknown;
  try {
    const response = await axios.post<unknown>(
      `${config.mlServiceUrl}/score-duplicates`,
      {
        newDescription: description,
        newCategory: category,
        candidates: candidates.map(
          ({
            id,
            description: candidateDescription,
            category: candidateCategory,
            distanceMeters,
          }) => ({
            id,
            description: candidateDescription,
            category: candidateCategory,
            distanceMeters,
          }),
        ),
      },
      { timeout: config.mlServiceTimeoutMs },
    );
    responseData = response.data;
  } catch (error) {
    const reason = axios.isAxiosError(error) ? (error.code ?? error.message) : 'unexpected error';
    console.warn(`[ML] Duplicate suggestion unavailable (${reason}).`);
    return unavailableResult();
  }

  const parsed = duplicateScoreResponseSchema.safeParse(responseData);
  if (!parsed.success) {
    console.error('[ML] Duplicate service returned an invalid response.');
    return unavailableResult();
  }

  const candidatesById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  if (parsed.data.scoredCandidates.some((candidate) => !candidatesById.has(candidate.id))) {
    console.error('[ML] Duplicate service returned an unknown candidate.');
    return unavailableResult();
  }

  const matches = parsed.data.scoredCandidates
    .filter((candidate) => candidate.textSimilarity > 0)
    .flatMap((score) => {
      const report = candidatesById.get(score.id);
      if (!report) {
        return [];
      }

      return [
        {
          category: report.category,
          status: report.status,
          distanceBand:
            report.distanceMeters <= 250 ? ('within_250m' as const) : ('250m_to_500m' as const),
        },
      ];
    });

  return matches.length > 0
    ? { matches, suggestionsUnavailable: false }
    : {
        matches: [],
        suggestionsUnavailable: false,
        message: 'No text-similar reports were found within 500 m. You can submit your report.',
      };
}
