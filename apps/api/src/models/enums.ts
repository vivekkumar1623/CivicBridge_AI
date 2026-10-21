/**
 * CivicBridge AI — Fixed Enums and Constants
 *
 * Single source of truth for Category, Status, Priority, Role, and CategoryDecision enums.
 * Matches section 2 of docs/PLAYBOOK.md exactly.
 */

export const CATEGORY_VALUES = [
  'road_damage',
  'waste_management',
  'streetlight',
  'water_drainage',
  'public_property',
  'other',
] as const;

export type Category = (typeof CATEGORY_VALUES)[number];

export const STATUS_VALUES = [
  'submitted',
  'under_review',
  'in_progress',
  'resolved',
  'rejected',
] as const;

export type Status = (typeof STATUS_VALUES)[number];

export const PRIORITY_VALUES = ['low', 'normal', 'high'] as const;

export type Priority = (typeof PRIORITY_VALUES)[number];

export const ROLE_VALUES = ['citizen', 'admin'] as const;

export type Role = (typeof ROLE_VALUES)[number];

export const CATEGORY_DECISION_VALUES = [
  'accepted_suggestion',
  'overrode_suggestion',
  'manual_fallback',
] as const;

export type CategoryDecision = (typeof CATEGORY_DECISION_VALUES)[number];
