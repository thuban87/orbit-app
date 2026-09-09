import type { ContactMethodRow } from "@/db/contact-methods-dao";
import {
  type ContactMethodGroups,
  listContactMethodGroups,
  selectActionablePrimaryMethods,
} from "@/db/contact-methods-read";
import { getContactHeader } from "@/db/contact-read";
import { getContactStatus } from "@/db/contact-status-read";
import { getImpactInputs, type ImpactInputs } from "@/db/impact-read";
import {
  type ProfileHistory,
  readProfileHistory,
} from "@/db/profile-history-read";
import {
  type ProfileKnowledge,
  readProfileKnowledge,
} from "@/db/profile-knowledge-read";
import { readProfilePresentationInputsCore } from "@/db/profile-presentation-read";
import { inReadSnapshot, type ReadOnlyExecutor } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { FACTORY_PROFILE_LAYOUT } from "@/profile/presentation-schema";
import type { ProfilePresentationInputs } from "@/profile/types";
import { computeContactGravity } from "@/services/impact";
import {
  type ProfileGravityMetric,
  type ProfileIntensityMetric,
  type ProfileStatusMetric,
  resolveProfileGravity,
  resolveProfileIntensity,
  resolveProfileStatus,
} from "@/services/profile-metrics";

export interface ProfileIdentity {
  id: number;
  name: string;
  categoryName: string | null;
  photo: string | null;
  photoCacheBust: string;
  favouriteRank: number | null;
  archivedAt: string | null;
  trackingEnabled: number;
  intervalDays: number | null;
  rarelyResponds: number;
  snoozeUntil: string | null;
}

export type ProfileSectionResult<T> =
  | { status: "ready"; data: T }
  | { status: "error"; message: string };

export interface ProfileSnapshot {
  identity: ProfileIdentity;
  presentation: ProfilePresentationInputs;
  impactInputs: ImpactInputs;
  metrics: {
    status: ProfileStatusMetric;
    gravity: ProfileGravityMetric;
    intensity: ProfileIntensityMetric;
  };
  methods: ContactMethodGroups;
  actionableMethods: {
    phone: ContactMethodRow | null;
    email: ContactMethodRow | null;
  };
  knowledge: ProfileSectionResult<ProfileKnowledge>;
  history: ProfileSectionResult<ProfileHistory>;
}

export interface ProfileSnapshotOptions {
  now: string;
  themeBackground: string;
}

export interface ProfileReadDependencies {
  readKnowledge(
    exec: ReadOnlyExecutor,
    contactId: number,
  ): Promise<ProfileKnowledge>;
  readHistory(
    exec: ReadOnlyExecutor,
    contactId: number,
  ): Promise<ProfileHistory>;
}

const DEFAULT_DEPENDENCIES: ProfileReadDependencies = {
  readKnowledge: readProfileKnowledge,
  readHistory: readProfileHistory,
};

export class ProfileOptionalSectionError extends Error {
  constructor(
    readonly section: "knowledge" | "history",
    message: string,
  ) {
    super(message);
    this.name = "ProfileOptionalSectionError";
  }
}

async function readOptionalSection<T>(
  section: ProfileOptionalSectionError["section"],
  reader: () => Promise<T>,
): Promise<ProfileSectionResult<T>> {
  try {
    return { status: "ready", data: await reader() };
  } catch (error) {
    if (
      error instanceof ProfileOptionalSectionError &&
      error.section === section
    ) {
      return { status: "error", message: error.message };
    }
    throw error;
  }
}

/**
 * Build one renderer-neutral, local-only Profile snapshot under the shared read
 * mutex. Only deliberately classified optional-section failures are contained;
 * missing schema, corrupt data, and transaction failures abort the snapshot.
 */
export function readProfileSnapshot(
  exec: SqlExecutor,
  contactId: number,
  options: ProfileSnapshotOptions,
  dependencyOverrides: Partial<ProfileReadDependencies> = {},
): Promise<ProfileSnapshot | null> {
  const dependencies = { ...DEFAULT_DEPENDENCIES, ...dependencyOverrides };
  return inReadSnapshot(exec, async (ro) => {
    const header = await getContactHeader(ro, contactId);
    if (header === null) return null;

    const category = await ro.getFirstAsync<{ name: string | null }>(
      `SELECT categories.name
         FROM contacts
         LEFT JOIN categories ON categories.id = contacts.category_id
        WHERE contacts.id = ?`,
      [contactId],
    );
    const [presentation, status, impactInputs, methods, knowledge, history] =
      await Promise.all([
        readProfilePresentationInputsCore(ro, contactId, {
          factoryLayout: FACTORY_PROFILE_LAYOUT,
          themeBackground: options.themeBackground,
        }),
        getContactStatus(ro, contactId),
        getImpactInputs(ro, contactId),
        listContactMethodGroups(ro, contactId),
        readOptionalSection("knowledge", () =>
          dependencies.readKnowledge(ro, contactId),
        ),
        readOptionalSection("history", () =>
          dependencies.readHistory(ro, contactId),
        ),
      ]);
    if (status === null || impactInputs === null) {
      throw new Error(
        `readProfileSnapshot: contact ${contactId} vanished during snapshot`,
      );
    }

    const hasHistory = impactInputs.interactions.length > 0;
    return {
      identity: {
        id: header.id,
        name: header.name,
        categoryName: category?.name ?? null,
        photo: header.photo,
        photoCacheBust: header.modified_at,
        favouriteRank: header.favourite_rank,
        archivedAt: header.archived_at,
        trackingEnabled: header.trackingEnabled,
        intervalDays: header.intervalDays,
        rarelyResponds: header.rarely_responds,
        snoozeUntil: header.snooze_until,
      },
      presentation,
      impactInputs,
      metrics: {
        status: resolveProfileStatus({
          trackingEnabled: header.trackingEnabled,
          intervalDays: header.intervalDays,
          status: status.status,
          progress: status.progress,
          lastContact: status.last_contact,
          rarelyResponds: status.rarely_responds,
          rogueReason: status.reason,
        }),
        gravity: resolveProfileGravity(
          hasHistory ? computeContactGravity(impactInputs, options.now) : null,
          impactInputs.interactions.length,
        ),
        intensity: resolveProfileIntensity(impactInputs, options.now),
      },
      methods,
      actionableMethods: selectActionablePrimaryMethods(methods),
      knowledge,
      history,
    };
  });
}
