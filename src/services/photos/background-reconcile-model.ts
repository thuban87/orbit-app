import {
  type BackgroundReconcileAction,
  reconcileBackgroundDir,
} from "./background-storage";

const BACKGROUND_DIR = "profile-backgrounds";

export interface BackgroundReconciliationPlan {
  actions: Array<
    BackgroundReconcileAction | { kind: "deleteCanonical"; relative: string }
  >;
  missingReferences: string[];
}

/**
 * Produces a DB-aware cleanup plan. Template rows are the durable image
 * referrers: global, Category, and contact assignments point at template UIDs,
 * so any live template path remains protected regardless of assignment scope.
 */
export function planBackgroundReconciliation(input: {
  entries: string[];
  referencedPaths: ReadonlySet<string>;
}): BackgroundReconciliationPlan {
  const listedCanonical = new Set(
    input.entries
      .filter((entry) => /^[A-Za-z0-9_-]+\.jpg$/.test(entry))
      .map((entry) => `${BACKGROUND_DIR}/${entry}`),
  );
  const actions: BackgroundReconciliationPlan["actions"] = [];
  for (const relative of listedCanonical) {
    if (!input.referencedPaths.has(relative)) {
      actions.push({ kind: "deleteCanonical", relative });
    }
  }
  for (const action of reconcileBackgroundDir(input.entries)) {
    if (action.kind === "restoreBak" && !input.referencedPaths.has(action.to)) {
      actions.push({ kind: "deleteBak", relative: action.from });
    } else {
      actions.push(action);
    }
  }
  const recoverable = new Set(
    input.entries
      .filter((entry) => /^[A-Za-z0-9_-]+\.jpg\.bak$/.test(entry))
      .map((entry) => `${BACKGROUND_DIR}/${entry.slice(0, -".bak".length)}`),
  );
  return {
    actions,
    missingReferences: [...input.referencedPaths]
      .filter(
        (relative) =>
          !listedCanonical.has(relative) && !recoverable.has(relative),
      )
      .sort(),
  };
}
