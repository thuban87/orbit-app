import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomFieldDef } from "@/db/field-types";
import { THEME_PRESETS } from "@/theme/theme-presets";

/**
 * A type change that flags values offers "Review now" (38.12 D-121; D-24;
 * convergence c2 B-5). Editing a text field holding "Gold" into a dropdown
 * with options ["Platinum"]: the pre-flight runs on the target type AND
 * options, the one §14.4 summary counts 1 to fix, and once the change has
 * applied a themed "Review now" / "Later" offer opens the CustomFieldReview
 * list. Nothing flagged: no offer, and the summary has no "need your input"
 * clause (D-139).
 *
 * Shallow render on custom-fields-header-render.test.tsx's harness: the
 * `useState` slot harness seeds the edit editor; the form's `onSubmit` runs
 * the real save handler over mocked DAOs.
 */

const EDITOR_SLOT = 2;

const hooks = vi.hoisted(() => ({
  states: [] as unknown[],
  setters: [] as ((next: unknown) => void)[],
  index: 0,
}));

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useRef: (value: unknown) => ({ current: value }),
  useCallback: (fn: unknown) => fn,
  useMemo: (factory: () => unknown) => factory(),
  useEffect: () => {},
  useState: (value: unknown) => {
    const slot = hooks.index++;
    if (!(slot in hooks.states)) {
      hooks.states[slot] =
        typeof value === "function" ? (value as () => unknown)() : value;
    }
    if (!hooks.setters[slot]) {
      hooks.setters[slot] = (next: unknown) => {
        hooks.states[slot] =
          typeof next === "function"
            ? (next as (previous: unknown) => unknown)(hooks.states[slot])
            : next;
      };
    }
    return [hooks.states[slot], hooks.setters[slot]];
  },
}));
const navigate = vi.hoisted(() => vi.fn());
vi.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate }),
}));
vi.mock("react-native", () => ({
  AccessibilityInfo: { setAccessibilityFocus: vi.fn() },
  findNodeHandle: vi.fn(),
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  Text: "Text",
  View: "View",
  StyleSheet: {
    create: (styles: unknown) => styles,
    absoluteFill: {},
    hairlineWidth: 1,
  },
}));
vi.mock("@/theme", () => ({
  useTheme: () => ({ colors: THEME_PRESETS.galaxy.dark }),
}));
vi.mock("@/components/ShellAppBar", () => ({ ShellAppBar: "ShellAppBar" }));
vi.mock("react-native-reorderable-list", () => ({
  default: "ReorderableList",
  useReorderableDrag: () => vi.fn(),
}));
vi.mock("@/components/icons/Icon", () => ({ Icon: "Icon" }));
vi.mock("@/components/ui/AnchoredMenu", () => ({
  AnchoredMenu: "AnchoredMenu",
}));
vi.mock("@/components/FieldDefForm", () => ({
  FieldDefForm: "FieldDefForm",
  FIELD_TYPE_LABELS: {},
}));
vi.mock("@/db/ai-permissions-dao", () => ({
  resolveNewItemAiDefault: vi.fn(async () => 0),
}));
vi.mock("@/db/database", () => ({
  getExecutor: vi.fn(() => "exec"),
  localDateTime: vi.fn(() => "2026-10-17 12:00:00"),
}));
vi.mock("@/db/field-ddl", () => ({
  createField: vi.fn(),
  deleteOrQuarantineField: vi.fn(),
}));
const dao = vi.hoisted(() => ({
  applyTypeChange: vi.fn(),
  changeFieldOptions: vi.fn(),
  preflightTypeChange: vi.fn(),
  updateFieldShareWithAi: vi.fn(),
}));
vi.mock("@/db/field-defs-dao", () => ({
  changeFieldOptions: dao.changeFieldOptions,
  countFieldValues: vi.fn(async () => 0),
  listDefs: vi.fn(async () => []),
  renameField: vi.fn(),
  reorderFields: vi.fn(),
  restoreField: vi.fn(),
  updateFieldCuration: vi.fn(),
  updateFieldShareWithAi: dao.updateFieldShareWithAi,
}));
vi.mock("@/db/field-type-change", () => ({
  applyTypeChange: dao.applyTypeChange,
  preflightOptionsChange: vi.fn(),
  preflightTypeChange: dao.preflightTypeChange,
}));
vi.mock("@/navigation/discard-keep-guard", () => ({
  useDiscardKeepGuard: () => ({ requestClose: vi.fn(), settleHold: vi.fn() }),
}));
vi.mock("@/navigation/use-bottom-clearance", () => ({
  useBottomClearance: () => 96,
}));
const dialogs = vi.hoisted(() => ({ confirm: vi.fn(), notice: vi.fn() }));
vi.mock("@/stores/confirm-store", () => dialogs);
vi.mock("@/stores/snackbar-store", () => ({ showSnackbar: vi.fn() }));
vi.mock("@/utils/logger", () => ({ Logger: { error: vi.fn() } }));

const { CustomFieldsScreen } = await import("./CustomFieldsScreen");

type TestElement = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): TestElement[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const element = node as TestElement;
  return [element, ...nodes(element.props.children as ReactNode)];
}

const TIER = {
  id: 7,
  col_name: "tier",
  label: "Tier",
  type: "text",
  options: null,
  show_on_new: 0,
  always_show: 0,
  share_with_ai: 0,
} as unknown as CustomFieldDef;

const TO_DROPDOWN = {
  label: "Tier",
  type: "dropdown",
  options: JSON.stringify(["Platinum"]),
  show_on_new: 0,
  always_show: 0,
  share_with_ai: 0,
};

function submitEdit(draft: typeof TO_DROPDOWN, field: CustomFieldDef = TIER) {
  hooks.states = [];
  hooks.setters = [];
  hooks.states[EDITOR_SLOT] = { mode: "edit", field };
  hooks.index = 0;
  const form = nodes(CustomFieldsScreen()).find(
    (node) => node.type === "FieldDefForm",
  );
  if (!form) throw new Error("the edit form is not rendered");
  (form.props.onSubmit as (draft: unknown) => void)(draft);
}

beforeEach(() => {
  navigate.mockReset();
  dialogs.confirm.mockReset();
  dao.applyTypeChange.mockReset();
  dao.changeFieldOptions.mockReset();
  dao.preflightTypeChange.mockReset();
  dao.updateFieldShareWithAi.mockReset();
});

describe("Photo → another type with Share with AI on keeps it on (C-WR-01)", () => {
  it("applies the type change before the share write, so the clamp sees the new type", async () => {
    const photo = {
      ...TIER,
      type: "photo",
      share_with_ai: 0,
    } as unknown as CustomFieldDef;
    dao.preflightTypeChange.mockResolvedValue({
      total: 0,
      convert: [],
      flag: [],
    });
    dialogs.confirm.mockResolvedValue(true);

    submitEdit(
      {
        ...TO_DROPDOWN,
        type: "text",
        options: null,
        share_with_ai: 1,
      } as never,
      photo,
    );

    await vi.waitFor(() =>
      expect(dao.updateFieldShareWithAi).toHaveBeenCalledWith(
        "exec",
        7,
        1,
        "2026-10-17 12:00:00",
      ),
    );
    expect(dao.applyTypeChange.mock.invocationCallOrder[0]).toBeLessThan(
      dao.updateFieldShareWithAi.mock.invocationCallOrder[0],
    );
  });
});

describe('a type change that flags values offers "Review now" (38.12 D-121, D-24; B-5)', () => {
  it('text "Gold" → dropdown ["Platinum"]: one summary counting 1 to fix, then Review now opens the list', async () => {
    dao.preflightTypeChange.mockResolvedValue({
      total: 1,
      convert: [],
      flag: [3],
    });
    dialogs.confirm.mockResolvedValue(true);

    submitEdit(TO_DROPDOWN);

    await vi.waitFor(() => expect(navigate).toHaveBeenCalled());
    // The pre-flight ran on the target type AND options (B-5).
    expect(dao.preflightTypeChange).toHaveBeenCalledWith("exec", TIER, {
      type: "dropdown",
      options: '["Platinum"]',
    });
    // The one §14.4 summary, then the offer: two dialogs, the offer after
    // the change applied.
    expect(dialogs.confirm).toHaveBeenCalledTimes(2);
    const [summary] = dialogs.confirm.mock.calls[0];
    expect(summary.message).toBe(
      "0 of 1 value will convert automatically. 1 needs your input — fix now or later.",
    );
    const [offer] = dialogs.confirm.mock.calls[1];
    expect(offer).toMatchObject({
      title: "Tier changed",
      message: "1 value needs your input.",
      confirmLabel: "Review now",
      cancelLabel: "Later",
    });
    expect(offer.destructive).toBeFalsy();
    const applyOrder = dao.applyTypeChange.mock.invocationCallOrder[0];
    const offerOrder = dialogs.confirm.mock.invocationCallOrder[1];
    expect(applyOrder).toBeLessThan(offerOrder);
    expect(navigate).toHaveBeenCalledWith("CustomFieldReview", {
      fieldDefId: 7,
    });
  });

  it("Later leaves the user on Custom Fields", async () => {
    dao.preflightTypeChange.mockResolvedValue({
      total: 1,
      convert: [],
      flag: [3],
    });
    dialogs.confirm.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    submitEdit(TO_DROPDOWN);

    await vi.waitFor(() => expect(dialogs.confirm).toHaveBeenCalledTimes(2));
    expect(navigate).not.toHaveBeenCalled();
  });

  it("nothing flagged: no offer, and the summary has no 'need your input' clause (D-139)", async () => {
    dao.preflightTypeChange.mockResolvedValue({
      total: 1,
      convert: [3],
      flag: [],
    });
    dialogs.confirm.mockResolvedValue(true);

    submitEdit(TO_DROPDOWN);

    await vi.waitFor(() => expect(dao.applyTypeChange).toHaveBeenCalled());
    await vi.waitFor(() => expect(dao.changeFieldOptions).toHaveBeenCalled());
    expect(dialogs.confirm).toHaveBeenCalledTimes(1);
    expect(dialogs.confirm.mock.calls[0][0].message).toBe(
      "1 of 1 value will convert automatically.",
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it("a cancelled summary writes nothing and offers nothing", async () => {
    dao.preflightTypeChange.mockResolvedValue({
      total: 1,
      convert: [],
      flag: [3],
    });
    dialogs.confirm.mockResolvedValue(false);

    submitEdit(TO_DROPDOWN);

    await vi.waitFor(() => expect(dialogs.confirm).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    expect(dao.applyTypeChange).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});
