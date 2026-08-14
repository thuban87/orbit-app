/**
 * Frequency options for contact intervals.
 * Defines how often you intend to reach out to a contact.
 */
export type Frequency =
  | "Daily"
  | "Weekly"
  | "Bi-Weekly"
  | "Monthly"
  | "Quarterly"
  | "Bi-Annually"
  | "Yearly";

/**
 * Maps frequency values to their equivalent in days.
 */
export const FREQUENCY_DAYS: Record<Frequency, number> = {
  Daily: 1,
  Weekly: 7,
  "Bi-Weekly": 14,
  Monthly: 30,
  Quarterly: 90,
  "Bi-Annually": 182,
  Yearly: 365,
};

/**
 * Orbital status indicating relationship health.
 */
export type OrbitStatus = "stable" | "wobble" | "decay" | "snoozed";

/**
 * Social battery impact of a contact.
 */
export type SocialBattery = "Charger" | "Neutral" | "Drain";

/**
 * Type of last interaction with a contact.
 */
export type LastInteractionType =
  | "call"
  | "text"
  | "in-person"
  | "email"
  | "other";

/**
 * Represents a contact in the Orbit system.
 */
export interface OrbitContact {
  /** Contact's name (derived from file basename) */
  name: string;

  /** Category (e.g., Family, Friends, Work) */
  category?: string;

  /** Contact frequency setting */
  frequency: Frequency;

  /** Date of last contact (YYYY-MM-DD string or Date object) */
  lastContact: Date | null;

  /** Calculated orbital status */
  status: OrbitStatus;

  /** Days since last contact */
  daysSinceContact: number;

  /** Days until contact becomes overdue (negative if already overdue) */
  daysUntilDue: number;

  /** Photo URL for avatar */
  photo?: string;

  /** Social battery impact */
  socialBattery?: SocialBattery;

  /** Snooze until date (YYYY-MM-DD) - contact won't show as overdue until after this date */
  snoozeUntil?: Date | null;

  /** Type of last interaction */
  lastInteraction?: LastInteractionType;

  /** Contact's birthday (MM-DD or YYYY-MM-DD format) */
  birthday?: string;

  /** Conversational fuel content (cached) */
  fuel?: string[];
}

/**
 * Calculate the orbital status based on days since contact and frequency.
 *
 * @param lastContact - Date of last contact
 * @param frequency - Target contact frequency
 * @returns OrbitStatus - 'stable', 'wobble', or 'decay'
 */
export function calculateStatus(
  lastContact: Date | null,
  frequency: Frequency,
): OrbitStatus {
  if (!lastContact) {
    return "decay"; // No contact ever = decayed
  }

  const now = new Date();
  const diffTime = now.getTime() - lastContact.getTime();
  const daysSince = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const threshold = FREQUENCY_DAYS[frequency];

  // Green: Less than 80% of interval elapsed
  if (daysSince < threshold * 0.8) {
    return "stable";
  }

  // Yellow: Between 80% and 100% of interval
  if (daysSince < threshold) {
    return "wobble";
  }

  // Red: Past the threshold
  return "decay";
}

/**
 * Calculate days since last contact.
 *
 * @param lastContact - Date of last contact
 * @returns Number of days since contact (or Infinity if null)
 */
export function calculateDaysSince(lastContact: Date | null): number {
  if (!lastContact) return Infinity;

  const now = new Date();
  const diffTime = now.getTime() - lastContact.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calculate days until contact becomes due.
 *
 * @param lastContact - Date of last contact
 * @param frequency - Target contact frequency
 * @returns Days until due (negative if overdue)
 */
export function calculateDaysUntilDue(
  lastContact: Date | null,
  frequency: Frequency,
): number {
  if (!lastContact) return -Infinity;

  const daysSince = calculateDaysSince(lastContact);
  const threshold = FREQUENCY_DAYS[frequency];
  return threshold - daysSince;
}

/**
 * Parse a date string in various formats.
 *
 * @param dateStr - Date string (e.g., "2024-01-15")
 * @returns Date object or null if invalid
 */
export function parseDate(dateStr: string | undefined | null): Date | null {
  if (!dateStr) return null;

  // Try ISO format first (YYYY-MM-DD)
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const date = new Date(
      parseInt(year, 10),
      parseInt(month, 10) - 1,
      parseInt(day, 10),
    );
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  // Fallback: try native Date parsing
  const date = new Date(dateStr);
  if (!Number.isNaN(date.getTime())) {
    return date;
  }

  return null;
}

/**
 * Validate if a string is a valid Frequency value.
 */
export function isValidFrequency(
  value: string | undefined,
): value is Frequency {
  if (!value) return false;
  return Object.keys(FREQUENCY_DAYS).includes(value);
}
