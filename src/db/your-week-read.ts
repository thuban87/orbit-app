/**
 * App-wide, read-only Your Week aggregation (Phase 38, S-10/S-11/S-12).
 *
 * Stored timestamps are local wall-clock values, so SQL truncates them with
 * bare `date(column)`. Period bounds are always bound parameters. This module
 * performs async on-device reads only: no writer, transaction, or network.
 */
import type { SqlExecutor } from "@/db/types";

export interface YourWeekMetrics {
  readonly peopleReached: number;
  readonly interactions: number;
  readonly events: number;
}

export interface YourWeekDateCount {
  readonly d: string;
  readonly n: number;
}

export interface YourWeekDayRow {
  readonly kind: "group_event" | "interaction";
  readonly id: number;
  readonly occurredAt: string;
  readonly title: string | null;
  readonly contactId: number | null;
  readonly contactName: string | null;
}

/** Headline counts: child interaction rows and parent events are distinct units. */
export async function readYourWeekMetrics(
  exec: SqlExecutor,
  start: string,
  end: string,
): Promise<YourWeekMetrics> {
  const row = await exec.getFirstAsync<YourWeekMetrics>(
    `SELECT
       (SELECT COUNT(DISTINCT i.contact_id)
          FROM interactions i
          JOIN contacts c ON c.id = i.contact_id
         WHERE c.archived_at IS NULL
           AND date(i.occurred_at) BETWEEN date(?) AND date(?)) AS peopleReached,
       (SELECT COUNT(*)
          FROM interactions i
          JOIN contacts c ON c.id = i.contact_id
         WHERE c.archived_at IS NULL
           AND date(i.occurred_at) BETWEEN date(?) AND date(?)) AS interactions,
       (SELECT COUNT(*)
          FROM group_events ge
         WHERE date(ge.occurred_at) BETWEEN date(?) AND date(?)) AS events`,
    [start, end, start, end, start, end],
  );
  return row ?? { peopleReached: 0, interactions: 0, events: 0 };
}

/**
 * Heatmap activity units by local date: standalone interaction = 1, Group
 * Event parent = 1. Group-linked child rows never enter this aggregation.
 */
export function readYourWeekDateCounts(
  exec: SqlExecutor,
  start: string,
  end: string,
): Promise<YourWeekDateCount[]> {
  return exec.getAllAsync<YourWeekDateCount>(
    `SELECT activity_date AS d, COUNT(*) AS n
       FROM (
         SELECT date(i.occurred_at) AS activity_date
           FROM interactions i
           JOIN contacts c ON c.id = i.contact_id
          WHERE i.group_event_id IS NULL
            AND c.archived_at IS NULL
            AND date(i.occurred_at) BETWEEN date(?) AND date(?)
         UNION ALL
         SELECT date(ge.occurred_at) AS activity_date
           FROM group_events ge
          WHERE date(ge.occurred_at) BETWEEN date(?) AND date(?)
       ) activity
      GROUP BY activity_date
      ORDER BY activity_date`,
    [start, end, start, end],
  );
}

/** One app-wide day list with each Group Event parent represented once. */
export function readYourWeekDay(
  exec: SqlExecutor,
  date: string,
): Promise<YourWeekDayRow[]> {
  return exec.getAllAsync<YourWeekDayRow>(
    `SELECT 'group_event' AS kind,
            ge.id AS id,
            ge.occurred_at AS occurredAt,
            ge.title AS title,
            NULL AS contactId,
            NULL AS contactName
       FROM group_events ge
      WHERE date(ge.occurred_at) = date(?)
      UNION ALL
     SELECT 'interaction' AS kind,
            i.id AS id,
            i.occurred_at AS occurredAt,
            NULL AS title,
            c.id AS contactId,
            c.name AS contactName
       FROM interactions i
       JOIN contacts c ON c.id = i.contact_id
      WHERE i.group_event_id IS NULL
        AND c.archived_at IS NULL
        AND date(i.occurred_at) = date(?)
      ORDER BY occurredAt DESC, kind, id DESC`,
    [date, date],
  );
}
