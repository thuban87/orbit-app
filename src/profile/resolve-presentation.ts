import {
  FACTORY_PROFILE_LAYOUT,
  parseAndCanonicalizeProfileLayout,
} from "./presentation-schema";
import type {
  MissingProfilePresentationReference,
  ProfileBackgroundTemplateValue,
  ProfileLayoutDocument,
  ProfileLayoutTemplateValue,
  ProfilePresentation,
  ProfilePresentationInputs,
} from "./types";

type CompletableBucket = "overview" | "thingsToRemember";

/**
 * Read-time completion of one bucket of a saved layout. A layout saved before
 * a module existed lacks its id; each missing factory module is inserted at
 * its factory position, just after the nearest earlier factory module the
 * layout has, with its factory flags (and size). The user's own order and
 * flags are kept. Nothing is written back, so no migration is needed.
 * 38.10 introduced this for Thought of Them and Gift Ideas (D-44); 38.11 uses
 * it for the Birthday overview tile (D-53, D-80).
 */
function completeBucketAtFactoryPositions(
  document: ProfileLayoutDocument,
  bucket: CompletableBucket,
): ProfileLayoutDocument {
  const factory = FACTORY_PROFILE_LAYOUT[bucket] as readonly {
    id: string;
  }[];
  const current = document[bucket] as readonly { id: string }[];
  const present = new Set(current.map((placement) => placement.id));
  if (factory.every((placement) => present.has(placement.id))) return document;
  const result = current.map((placement) => ({ ...placement }));
  factory.forEach((placement, factoryIndex) => {
    if (present.has(placement.id)) return;
    let insertAt = 0;
    for (let earlier = factoryIndex - 1; earlier >= 0; earlier -= 1) {
      const index = result.findIndex(
        (candidate) => candidate.id === factory[earlier]?.id,
      );
      if (index >= 0) {
        insertAt = index + 1;
        break;
      }
    }
    result.splice(insertAt, 0, { ...placement });
    present.add(placement.id);
  });
  return { ...document, [bucket]: result } as ProfileLayoutDocument;
}

/**
 * Read-time completion of the Overview tiles and the Things to Remember
 * sections, each missing module at its factory position. The Profile and the
 * layout editor both use this, so they place a new module identically
 * (38.11 D-53, D-80; RESEARCH Pitfall 6). Returns the same object when
 * nothing is missing.
 */
export function completeProfileLayoutChildren(
  document: ProfileLayoutDocument,
): ProfileLayoutDocument {
  return completeBucketAtFactoryPositions(
    completeBucketAtFactoryPositions(document, "overview"),
    "thingsToRemember",
  );
}

export function resolveProfilePresentation(
  input: ProfilePresentationInputs,
): ProfilePresentation {
  const missingReferences: MissingProfilePresentationReference[] = [];
  const layouts = new Map<string, ProfileLayoutTemplateValue>(
    input.layoutTemplates.map((item) => [item.uid, item]),
  );
  const backgrounds = new Map<string, ProfileBackgroundTemplateValue>(
    input.backgroundTemplates.map((item) => [item.uid, item]),
  );

  let layout: ProfilePresentation["layout"] | null = null;
  if (input.contact.freeformLayout !== null) {
    layout = {
      source: "contact-freeform",
      templateUid: null,
      document: parseAndCanonicalizeProfileLayout(input.contact.freeformLayout),
    };
  }
  for (const [source, uid] of [
    ["contact", input.contact.layoutTemplateUid],
    ["category", input.category?.layoutTemplateUid ?? null],
    ["global", input.global.layoutTemplateUid],
  ] as const) {
    if (layout || uid === null) continue;
    const found = layouts.get(uid);
    if (!found) {
      missingReferences.push({ axis: "layout", source, uid });
      continue;
    }
    layout = {
      source: source === "contact" ? "contact-template" : source,
      templateUid: uid,
      document: parseAndCanonicalizeProfileLayout(found.layout),
    };
  }
  layout ??= {
    source: "factory",
    templateUid: null,
    document: parseAndCanonicalizeProfileLayout(input.factoryLayout),
  };
  layout = {
    ...layout,
    document: completeProfileLayoutChildren(layout.document),
  };

  let background: ProfilePresentation["background"] | null = null;
  for (const [source, uid] of [
    ["contact", input.contact.backgroundTemplateUid],
    ["category", input.category?.backgroundTemplateUid ?? null],
    ["global", input.global.backgroundTemplateUid],
  ] as const) {
    if (background || uid === null) continue;
    const found = backgrounds.get(uid);
    if (!found) {
      missingReferences.push({ axis: "background", source, uid });
      continue;
    }
    background = { source, templateUid: uid, imagePath: found.imagePath };
  }
  background ??= {
    source: "theme",
    templateUid: null,
    imagePath: input.themeBackground,
  };

  return {
    layout,
    background,
    collapse: { ...input.contact.collapse },
    missingReferences,
  };
}
