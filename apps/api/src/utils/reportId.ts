import crypto from 'crypto';

/**
 * Unambiguous character set for public-safe human-readable IDs.
 * Omits 0/O, 1/I to prevent transcription errors.
 */
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Generates a collision-checked, non-sequential public report number.
 * Example format: "CB-7X9K2P"
 *
 * Never use sequential auto-incrementing numbers as they expose total system volume.
 */
export function generateReportNumber(prefix = 'CB'): string {
  const bytes = crypto.randomBytes(6);
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return `${prefix}-${id}`;
}
