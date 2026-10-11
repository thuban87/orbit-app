/**
 * DropdownFieldWidget on the shared OptionSheet (38.9 D-28). The data rule
 * (CLAUDE.md custom-field invariants; RG-030): a stored value outside the
 * option list is listed first and stays selected; nothing is cleared or
 * coerced, and only a user pick reaches onChange.
 */
import { describe, expect, it, vi } from "vitest";

const reactMocks = vi.hoisted(() => ({
  open: false,
  setOpen: vi.fn(),
}));

vi.mock("react", () => ({
  useState: <T,>(_value: T) => [reactMocks.open, reactMocks.setOpen],
}));
vi.mock("@/components/ui/OptionSelectRow", () => ({
  OptionSelectRow: "OptionSelectRow",
}));
vi.mock("@/components/ui/OptionSheet", () => ({ OptionSheet: "OptionSheet" }));

const { DropdownFieldWidget } = await import("./DropdownFieldWidget");

type Node = { type: unknown; props: Record<string, unknown> };

function render(value: string | null, options: string[]) {
  const onChange = vi.fn();
  const tree = DropdownFieldWidget({
    value,
    onChange,
    label: "Met via",
    options,
    testID: "met-via",
  }) as { props: { children: Node[] } };
  const [row, sheet] = tree.props.children;
  return { row, sheet, onChange };
}

describe("DropdownFieldWidget (D-28, out-of-list preserved)", () => {
  it("lists an out-of-list stored value first and keeps it selected", () => {
    const { row, sheet, onChange } = render("Old club", ["School", "Work"]);
    expect(sheet.type).toBe("OptionSheet");
    expect(sheet.props.options).toEqual([
      { value: "Old club", label: "Old club" },
      { value: "School", label: "School" },
      { value: "Work", label: "Work" },
    ]);
    expect(sheet.props.selected).toBe("Old club");
    expect(row.props).toMatchObject({
      label: "Met via",
      currentLabel: "Old club",
      testID: "met-via",
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not duplicate an in-list value and shows the placeholder when empty", () => {
    expect(render("Work", ["School", "Work"]).sheet.props.options).toEqual([
      { value: "School", label: "School" },
      { value: "Work", label: "Work" },
    ]);
    const empty = render(null, ["School"]);
    expect(empty.row.props.currentLabel).toBe("");
    expect(empty.sheet.props.selected).toBe("");
    expect(empty.onChange).not.toHaveBeenCalled();
  });

  it("emits the picked raw value, and opens and closes the sheet", () => {
    const { row, sheet, onChange } = render("Old club", ["School"]);
    (sheet.props.onSelect as (v: string) => void)("School");
    expect(onChange).toHaveBeenCalledWith("School");
    reactMocks.setOpen.mockClear();
    (row.props.onPress as () => void)();
    expect(reactMocks.setOpen).toHaveBeenCalledWith(true);
    (sheet.props.onRequestClose as () => void)();
    expect(reactMocks.setOpen).toHaveBeenCalledWith(false);
  });
});
