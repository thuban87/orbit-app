/** Pure composition for Digest's Up Next and Horizon modules. */
import { daysUntilBirthday } from "@/logic/birthday-logic";
import { formatLocalDate } from "@/utils/dates";

interface HasId {
  id: number;
}

interface BirthdayInput extends HasId {
  name: string;
  birthday: string | null;
}

export interface UpcomingBirthday<T extends BirthdayInput> {
  contact: T;
  id: number;
  name: string;
  birthday: string | null;
  daysUntil: number;
  tag: string;
}

/** Candidates arrive in canonical attention order; Digest shows at most three. */
export function pickUpNext<T>(candidates: readonly T[]): T[] {
  return candidates.slice(0, 3);
}

/** Up Next takes first claim over Horizon's same-condition Overlooked rows. */
export function dedupOverlooked<T extends HasId>(
  overlooked: readonly T[],
  upNextIds: Iterable<number>,
): T[] {
  const claimed = new Set(upNextIds);
  return overlooked.filter((row) => !claimed.has(row.id));
}

/** Horizon's independent forward seven-day birthday window (today through day 6). */
export function filterUpcomingBirthdays<T extends BirthdayInput>(
  candidates: readonly T[],
  today: Date,
): UpcomingBirthday<T>[] {
  return candidates
    .map((contact): UpcomingBirthday<T> | null => {
      const daysUntil = daysUntilBirthday(contact.birthday, today);
      if (daysUntil === null || daysUntil < 0 || daysUntil > 6) return null;
      const occurrence = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + daysUntil,
      );
      return {
        contact,
        id: contact.id,
        name: contact.name,
        birthday: contact.birthday,
        daysUntil,
        tag:
          daysUntil === 0
            ? "Today"
            : daysUntil === 1
              ? "Tomorrow"
              : formatLocalDate(occurrence),
      };
    })
    .filter((row): row is UpcomingBirthday<T> => row !== null)
    .sort((left, right) => {
      const byDay = left.daysUntil - right.daysUntil;
      if (byDay !== 0) return byDay;
      const byName = left.name
        .toLocaleLowerCase()
        .localeCompare(right.name.toLocaleLowerCase());
      return byName || left.id - right.id;
    });
}

export function neverContactedConditional(count: number): {
  present: boolean;
  count: number;
} {
  const safeCount = Math.max(0, Math.trunc(count));
  return { present: safeCount > 0, count: safeCount };
}

/** Compact preview plus a non-negative "+N more" count. */
export function previewWithOverflow<T>(
  rows: readonly T[],
  cap: number,
): { shown: T[]; overflow: number } {
  if (!Number.isInteger(cap) || cap < 0) {
    throw new Error("previewWithOverflow: cap must be a non-negative integer");
  }
  return {
    shown: rows.slice(0, cap),
    overflow: Math.max(0, rows.length - cap),
  };
}
