import { describe, expect, it } from "vitest";
import { createRechannelSheetState } from "./bulk-rechannel-sheet";

/** Mirrors HomeScreen's handlers: a pick re-channels, a cancel re-shows. */
function harness() {
  const sheet = createRechannelSheetState<{ batch: string }>();
  const calls: string[] = [];
  return {
    sheet,
    calls,
    onSelect(channel: string) {
      const target = sheet.take();
      if (target) calls.push(`rechannel:${target.batch}:${channel}`);
    },
    onRequestClose() {
      const target = sheet.take();
      if (target) calls.push(`reshow:${target.batch}`);
    },
  };
}

describe("bulk re-channel sheet state (38.14 D-62; review A-WR-02)", () => {
  it("a cancel re-shows the batch's snackbar, so Undo is not lost", () => {
    const h = harness();
    h.sheet.open({ batch: "b1" });
    h.onRequestClose();
    expect(h.calls).toEqual(["reshow:b1"]);
  });

  it("a pick (onSelect then onRequestClose, as OptionSheet calls them) re-channels once and never re-shows", () => {
    const h = harness();
    h.sheet.open({ batch: "b1" });
    h.onSelect("Call");
    h.onRequestClose();
    expect(h.calls).toEqual(["rechannel:b1:Call"]);
  });

  it("a close with nothing held does nothing", () => {
    const h = harness();
    h.onRequestClose();
    h.onSelect("Call");
    expect(h.calls).toEqual([]);
  });
});
