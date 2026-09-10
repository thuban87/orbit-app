import { describe, expect, it } from "vitest";
import { FACTORY_PROFILE_LAYOUT } from "./presentation-schema";
import { resolveProfilePresentation } from "./resolve-presentation";
import type { ProfilePresentationInputs } from "./types";

const layout = (visible: boolean) => ({
  ...FACTORY_PROFILE_LAYOUT,
  topLevel: FACTORY_PROFILE_LAYOUT.topLevel.map((item) => ({
    ...item,
    visible,
  })),
});

const base = (): ProfilePresentationInputs => ({
  factoryLayout: FACTORY_PROFILE_LAYOUT,
  themeBackground: "theme:galaxy",
  layoutTemplates: [
    { uid: "global-layout", layout: layout(false) },
    { uid: "category-layout", layout: layout(true) },
    { uid: "contact-layout", layout: FACTORY_PROFILE_LAYOUT },
  ],
  backgroundTemplates: [
    { uid: "global-bg", imagePath: "profile-backgrounds/global.webp" },
    { uid: "category-bg", imagePath: "profile-backgrounds/category.webp" },
    { uid: "contact-bg", imagePath: "profile-backgrounds/contact.webp" },
  ],
  global: {
    layoutTemplateUid: "global-layout",
    backgroundTemplateUid: "global-bg",
  },
  category: {
    layoutTemplateUid: "category-layout",
    backgroundTemplateUid: "category-bg",
  },
  contact: {
    layoutTemplateUid: null,
    freeformLayout: null,
    backgroundTemplateUid: null,
    collapse: {},
  },
});

describe("resolveProfilePresentation", () => {
  it("resolves layout and background independently with contact precedence", () => {
    const input = base();
    input.contact.layoutTemplateUid = "contact-layout";
    const resolved = resolveProfilePresentation(input);
    expect(resolved.layout.source).toBe("contact-template");
    expect(resolved.background.source).toBe("category");
  });

  it("keeps template defaults and persisted contact collapse authoritative over factory fallback", () => {
    const input = base();
    const templateLayout = {
      ...FACTORY_PROFILE_LAYOUT,
      topLevel: FACTORY_PROFILE_LAYOUT.topLevel.map((placement) => ({
        ...placement,
        expanded: true,
      })),
    };
    input.layoutTemplates[2] = { uid: "contact-layout", layout: templateLayout };
    input.contact.layoutTemplateUid = "contact-layout";
    input.contact.collapse = { "contact-methods": false };

    const resolved = resolveProfilePresentation(input);
    expect(resolved.layout.document.topLevel.every((placement) => placement.expanded)).toBe(true);
    expect(resolved.collapse).toEqual({ "contact-methods": false });
  });

  it("falls through missing references without rewriting or hiding diagnostics", () => {
    const input = base();
    input.contact.layoutTemplateUid = "missing-layout";
    input.category!.backgroundTemplateUid = "missing-bg";
    const resolved = resolveProfilePresentation(input);
    expect(resolved.layout.source).toBe("category");
    expect(resolved.background.source).toBe("global");
    expect(resolved.missingReferences).toEqual([
      { axis: "layout", source: "contact", uid: "missing-layout" },
      { axis: "background", source: "category", uid: "missing-bg" },
    ]);
    expect(input.contact.layoutTemplateUid).toBe("missing-layout");
  });

  it("drops inherited Category axes when Category becomes null while preserving explicit axes", () => {
    const inherited = base();
    inherited.category = null;
    expect(resolveProfilePresentation(inherited)).toMatchObject({
      layout: { source: "global" },
      background: { source: "global" },
    });

    const explicit = base();
    explicit.category = null;
    explicit.contact.layoutTemplateUid = "contact-layout";
    explicit.contact.backgroundTemplateUid = "contact-bg";
    expect(resolveProfilePresentation(explicit)).toMatchObject({
      layout: { source: "contact-template", templateUid: "contact-layout" },
      background: { source: "contact", templateUid: "contact-bg" },
    });

    const freeform = base();
    freeform.category = null;
    freeform.contact.freeformLayout = layout(false);
    expect(resolveProfilePresentation(freeform).layout).toMatchObject({
      source: "contact-freeform",
      document: layout(false),
    });
  });
});
