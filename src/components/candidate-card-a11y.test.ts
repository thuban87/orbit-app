/**
 * Review-card accessible representation (RG-031 ui-accessibility/AUD-UIA-008).
 *
 * Reconcile Grid cards and Review matches rows must announce the person, the
 * displayed recommendation/evidence and any per-card failure; expose `selected`
 * only while selecting; and offer a Select/Deselect action equivalent to the
 * long-press that enters selection.
 *
 * 38.12 D-107 / D-51: Duplicate Review left CandidateCardGrid for its own
 * one-column ReviewMatchesList, so the grid's tap/long-press source contract
 * below now guards Reconcile only; Review matches reuses the same helper and
 * selection action, pinned in its own block.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { NEEDS_YOUR_CHOICE } from "@/constants/glossary";
import {
  buildCandidateCardAccessibility,
  CANDIDATE_CARD_FAILURE_COPY,
  CANDIDATE_SELECTION_ACTION,
} from "./candidate-card-a11y";

const base = {
  name: "Ada Lovelace",
  recommendationText: "Probable match",
  evidenceHint: "Matching phone number",
  failureText: null,
  selected: false,
  selectionMode: false,
};

describe("buildCandidateCardAccessibility", () => {
  it("labels name, then recommendation, then evidence", () => {
    expect(buildCandidateCardAccessibility(base).accessibilityLabel).toBe(
      "Ada Lovelace. Probable match. Matching phone number.",
    );
  });

  it("appends the displayed per-card failure copy last", () => {
    const { accessibilityLabel } = buildCandidateCardAccessibility({
      ...base,
      failureText: CANDIDATE_CARD_FAILURE_COPY,
    });
    expect(accessibilityLabel).toBe(
      "Ada Lovelace. Probable match. Matching phone number. This action could not be completed. Try again.",
    );
  });

  it("omits parts that are not displayed (blank recommendation/evidence)", () => {
    expect(
      buildCandidateCardAccessibility({
        ...base,
        recommendationText: null,
        evidenceHint: "  ",
      }).accessibilityLabel,
    ).toBe("Ada Lovelace.");
  });

  it("announces reconciliation advisory copy as displayed", () => {
    expect(
      buildCandidateCardAccessibility({
        ...base,
        name: "Grace Hopper",
        recommendationText: NEEDS_YOUR_CHOICE,
        evidenceHint: "2 differences left",
      }).accessibilityLabel,
    ).toBe("Grace Hopper. Needs your choice. 2 differences left.");
  });

  it("an item with no photo still announces the name, with no photo copy", () => {
    const { accessibilityLabel } = buildCandidateCardAccessibility({
      ...base,
      name: "Unnamed contact",
    });
    expect(accessibilityLabel.startsWith("Unnamed contact.")).toBe(true);
    expect(accessibilityLabel).not.toMatch(/Photo of/);
  });

  it("outside selection mode exposes no `selected` state key", () => {
    const { accessibilityState } = buildCandidateCardAccessibility(base);
    expect(accessibilityState).toEqual({});
    expect("selected" in accessibilityState).toBe(false);
  });

  it.each([true, false])(
    "in selection mode exposes selected=%s matching the card",
    (selected) => {
      expect(
        buildCandidateCardAccessibility({
          ...base,
          selectionMode: true,
          selected,
        }).accessibilityState,
      ).toEqual({ selected });
    },
  );

  it("always offers a Select/Deselect action (the long-press equivalent)", () => {
    expect(buildCandidateCardAccessibility(base).accessibilityActions).toEqual([
      { name: CANDIDATE_SELECTION_ACTION, label: "Select" },
    ]);
    expect(
      buildCandidateCardAccessibility({
        ...base,
        selectionMode: true,
        selected: true,
      }).accessibilityActions,
    ).toEqual([{ name: CANDIDATE_SELECTION_ACTION, label: "Deselect" }]);
  });

  it("hints what activation does in each mode", () => {
    expect(buildCandidateCardAccessibility(base).accessibilityHint).toMatch(
      /Select action/,
    );
    expect(
      buildCandidateCardAccessibility({ ...base, selectionMode: true })
        .accessibilityHint,
    ).toMatch(/toggles selection/);
  });

  it("never announces the stable internal id", () => {
    const { accessibilityLabel, accessibilityHint } =
      buildCandidateCardAccessibility(base);
    expect(`${accessibilityLabel} ${accessibilityHint}`).not.toMatch(/\d{2,}/);
  });
});

describe("CandidateCardGrid wiring — Reconcile only (source contract)", () => {
  const source = readFileSync(
    resolve(__dirname, "CandidateCardGrid.tsx"),
    "utf8",
  );

  it("spreads the helper on the card and maps the action to toggleSelection", () => {
    expect(source.match(/buildCandidateCardAccessibility\(/g)).toHaveLength(1);
    expect(source).toMatch(/onAccessibilityAction/);
    expect(source).toMatch(
      /actionName === CANDIDATE_SELECTION_ACTION[\s\S]{0,80}toggleSelection\(item\)/,
    );
  });

  it("is Reconcile's grid only: Duplicate Review no longer renders it (D-51)", () => {
    const reconcile = readFileSync(
      resolve(__dirname, "../screens/ReconcileGridScreen.tsx"),
      "utf8",
    );
    const duplicate = readFileSync(
      resolve(__dirname, "../screens/DuplicateReviewScreen.tsx"),
      "utf8",
    );
    expect(reconcile).toMatch(/<CandidateCardGrid\b/);
    expect(duplicate).not.toMatch(/CandidateCardGrid/);
  });

  it("keeps Reconcile's long-press and press-to-inspect/toggle semantics unchanged", () => {
    expect(source).toMatch(/onLongPress=\{\(\) => toggleSelection\(item\)\}/);
    expect(source).toMatch(
      /multiSelect \? toggleSelection\(item\) : onInspect\(item\)/,
    );
  });

  it("renders the shared failure copy and a non-border selected mark", () => {
    expect(source).toMatch(/\{CANDIDATE_CARD_FAILURE_COPY\}/);
    expect(source).toMatch(/name="select"/);
    expect(source).not.toMatch(/accessibilityLabel=\{item\.name\}/);
  });
});

describe("ReviewMatchesList wiring (source contract, 38.12 D-107)", () => {
  const source = readFileSync(
    resolve(__dirname, "ReviewMatchesList.tsx"),
    "utf8",
  );

  it("reuses the same helper and Select/Deselect action as Reconcile", () => {
    expect(source.match(/buildCandidateCardAccessibility\(/g)).toHaveLength(1);
    expect(source).toMatch(
      /actionName === CANDIDATE_SELECTION_ACTION[\s\S]{0,80}toggleSelection\(item\)/,
    );
    expect(source).toMatch(/onLongPress=\{\(\) => toggleSelection\(item\)\}/);
    expect(source).toMatch(
      /multiSelect \? toggleSelection\(item\) : onInspect\(item\)/,
    );
  });
});
