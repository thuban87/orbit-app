import { parseAndCanonicalizeProfileLayout } from "./presentation-schema";
import type {
  MissingProfilePresentationReference,
  ProfileBackgroundTemplateValue,
  ProfileLayoutTemplateValue,
  ProfilePresentation,
  ProfilePresentationInputs,
} from "./types";

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
