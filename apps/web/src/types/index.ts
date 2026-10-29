export type Category =
  | 'road_damage'
  | 'waste_management'
  | 'streetlight'
  | 'water_drainage'
  | 'public_property'
  | 'other';

export type Status = 'submitted' | 'under_review' | 'in_progress' | 'resolved' | 'rejected';

export type Priority = 'low' | 'normal' | 'high';

export type Role = 'citizen' | 'admin';

export interface CategorySuggestion {
  suggestedCategory: Category | null;
  confidence: number;
  modelVersion: string | null;
  needsHumanReview: boolean;
  suggestionsUnavailable: boolean;
  message?: string;
}

export interface DuplicateSuggestion {
  category: Category;
  status: Status;
  distanceBand: 'within_250m' | '250m_to_500m';
}

export interface DuplicateSuggestionsResponse {
  matches: DuplicateSuggestion[];
  suggestionsUnavailable: boolean;
  message?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface ILocation {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface IStatusHistory {
  fromStatus: Status | null;
  toStatus: Status;
  changedBy: string | { _id: string; name: string };
  note?: string;
  changedAt: string;
}

export interface IPriorityHistory {
  fromPriority: Priority;
  toPriority: Priority;
  changedBy: string | { _id: string; name: string };
  note?: string;
  changedAt: string;
}

export interface Report {
  _id: string;
  reportNumber: string;
  createdBy: string | { _id: string; name: string; email: string };
  title: string;
  description: string;
  category: Category;
  aiSuggestedCategory: Category | null;
  aiConfidence: number | null;
  aiModelVersion: string | null;
  categoryDecision: 'accepted_suggestion' | 'overrode_suggestion' | 'manual_fallback';
  status: Status;
  priority: Priority;
  location?: ILocation;
  locationLabel?: string;
  photoKey?: string;
  resolutionNote?: string;
  rejectionReason?: string;
  statusHistory: IStatusHistory[];
  priorityHistory?: IPriorityHistory[];
  isDemoData: boolean;
  createdAt: string;
  updatedAt: string;
}

export const CATEGORY_LABELS: Record<Category, string> = {
  road_damage: 'Road & Pavement Damage',
  waste_management: 'Garbage & Waste Management',
  streetlight: 'Streetlight & Electrical',
  water_drainage: 'Water Supply & Drainage',
  public_property: 'Public Property & Infrastructure',
  other: 'Other Community Issue',
};

export const STATUS_LABELS: Record<Status, string> = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  rejected: 'Rejected',
};

export const STATUS_COLORS: Record<Status, { bg: string; text: string; border: string }> = {
  submitted: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  under_review: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
  in_progress: { bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-200' },
  resolved: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
  rejected: { bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-200' },
};
