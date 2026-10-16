import { describe, expect, it } from "vitest";
import { FACTORY_PROFILE_LAYOUT } from "./presentation-schema";
import {
  completeProfileLayoutChildren,
  resolveProfilePresentation,
} from "./resolve-presentation";
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
    input.contact.layoutTemplateUid = "contact-layout";
    input.contact.collapse = { "contact-methods": false };

    const resolved = resolveProfilePresentation({
      ...input,
      layoutTemplates: input.layoutTemplates.map((template) =>
        template.uid === "contact-layout"
          ? { ...template, layout: templateLayout }
          : template,
      ),
    });
    expect(
      resolved.layout.document.topLevel.every(
        (placement) => placement.expanded,
      ),
    ).toBe(true);
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

  it("falls through cleared background axes to the theme without changing layout precedence", () => {
    const input = base();
    input.contact.backgroundTemplateUid = null;
    input.category!.backgroundTemplateUid = null;
    input.global.backgroundTemplateUid = null;

    expect(resolveProfilePresentation(input)).toMatchObject({
      background: { source: "theme", imagePath: "theme:galaxy" },
      layout: { source: "category", templateUid: "category-layout" },
    });
  });

  it("completes a saved layout that predates Thought of Them and Gift Ideas, at their D-44 positions", () => {
    const saved = {
      ...FACTORY_PROFILE_LAYOUT,
      // A user-ordered layout saved before 38.10: Memories moved to the top,
      // Imported shown expanded, Off Limits hidden.
      thingsToRemember: [
        { id: "memories" as const, visible: true, expanded: true },
        { id: "pinned-featured" as const, visible: true, expanded: true },
        { id: "last-talked-about" as const, visible: true, expanded: true },
        { id: "key-people" as const, visible: true, expanded: false },
        { id: "current-location" as const, visible: true, expanded: true },
        { id: "custom-fields" as const, visible: true, expanded: true },
        { id: "off-limits" as const, visible: false, expanded: true },
        {
          id: "imported-contact-notes" as const,
          visible: true,
          expanded: true,
        },
      ],
    };
    const input = base();
    input.contact.freeformLayout = saved;
    const resolved = resolveProfilePresentation(input).layout.document;
    expect(resolved.thingsToRemember.map((p) => p.id)).toEqual([
      "memories",
      "thought-of-them",
      "gift-ideas",
      "pinned-featured",
      "last-talked-about",
      "key-people",
      "current-location",
      "custom-fields",
      "off-limits",
      "imported-contact-notes",
    ]);
    expect(
      resolved.thingsToRemember.find((p) => p.id === "gift-ideas"),
    ).toEqual({ id: "gift-ideas", visible: true, expanded: true });
    // The user's own flags are kept.
    expect(
      resolved.thingsToRemember.find((p) => p.id === "off-limits")?.visible,
    ).toBe(false);
    expect(
      resolved.thingsToRemember.find((p) => p.id === "key-people")?.expanded,
    ).toBe(false);
    // The stored document itself is not rewritten.
    expect(saved.thingsToRemember).toHaveLength(8);
  });

  it("completes a saved overview that predates Birthday right after Contact Frequency (D-80)", () => {
    const saved = {
      ...FACTORY_PROFILE_LAYOUT,
      // A user-ordered overview saved before 38.11: Snooze first, Gravity hidden.
      overview: [
        {
          id: "snooze" as const,
          visible: true,
          expanded: false,
          size: "1x1" as const,
        },
        {
          id: "orbit-status" as const,
          visible: true,
          expanded: false,
          size: "2x1" as const,
        },
        {
          id: "gravity" as const,
          visible: false,
          expanded: false,
          size: "1x1" as const,
        },
        {
          id: "intensity" as const,
          visible: true,
          expanded: false,
          size: "2x1" as const,
        },
        {
          id: "contact-frequency" as const,
          visible: true,
          expanded: false,
          size: "1x1" as const,
        },
        {
          id: "last-interaction" as const,
          visible: true,
          expanded: false,
          size: "1x1" as const,
        },
      ],
    };
    const input = base();
    input.contact.freeformLayout = saved;
    const resolved = resolveProfilePresentation(input).layout.document;
    expect(resolved.overview.map((p) => p.id)).toEqual([
      "snooze",
      "orbit-status",
      "gravity",
      "intensity",
      "contact-frequency",
      "birthday",
      "last-interaction",
    ]);
    expect(resolved.overview.find((p) => p.id === "birthday")).toEqual({
      id: "birthday",
      visible: true,
      expanded: false,
      size: "1x1",
    });
    // The user's own flags and sizes are kept; nothing is written back.
    expect(resolved.overview.find((p) => p.id === "gravity")?.visible).toBe(
      false,
    );
    expect(
      resolved.overview.find((p) => p.id === "last-interaction")?.size,
    ).toBe("1x1");
    expect(saved.overview).toHaveLength(6);
  });

  it("puts Birthday after the nearest earlier factory tile when Contact Frequency is absent", () => {
    const saved = {
      ...FACTORY_PROFILE_LAYOUT,
      overview: [
        {
          id: "last-interaction" as const,
          visible: true,
          expanded: false,
          size: "2x1" as const,
        },
        {
          id: "snooze" as const,
          visible: true,
          expanded: false,
          size: "1x1" as const,
        },
        {
          id: "orbit-status" as const,
          visible: true,
          expanded: false,
          size: "2x1" as const,
        },
      ],
    };
    const completed = completeProfileLayoutChildren(saved).overview.map(
      (p) => p.id,
    );
    // gravity/intensity follow orbit-status; contact-frequency then birthday
    // follow last-interaction (the nearest earlier factory tile present).
    expect(completed).toEqual([
      "last-interaction",
      "contact-frequency",
      "birthday",
      "snooze",
      "orbit-status",
      "gravity",
      "intensity",
    ]);
  });

  it("completes a template layout too, and leaves a complete layout unchanged", () => {
    const old = {
      ...FACTORY_PROFILE_LAYOUT,
      thingsToRemember: FACTORY_PROFILE_LAYOUT.thingsToRemember.filter(
        (p) => p.id !== "thought-of-them" && p.id !== "gift-ideas",
      ),
    };
    const input = base();
    input.layoutTemplates = [{ uid: "global-layout", layout: old }];
    input.category = null;
    const resolved = resolveProfilePresentation(input);
    expect(resolved.layout.source).toBe("global");
    expect(resolved.layout.document.thingsToRemember).toEqual(
      FACTORY_PROFILE_LAYOUT.thingsToRemember,
    );
    expect(completeProfileLayoutChildren(FACTORY_PROFILE_LAYOUT)).toBe(
      FACTORY_PROFILE_LAYOUT,
    );
  });
});
