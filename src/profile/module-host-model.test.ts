import { describe, expect, it, vi } from "vitest";
import {
  createHistoryRevealScroll,
  resolveHistoryReveal,
  resolveProfileModuleHostState,
} from "./module-host-model";

// 38.3 RG-021 (D-10, D-11, D-28): the Last Interaction tile and the Status
// sheet's "View history" reveal the in-Profile History section. The reveal is
// only offered when the layout shows History, and a collapsed History expands
// through the same persisted override a header tap writes.
describe("resolveHistoryReveal", () => {
  const visibleHistory = (expanded: boolean) => [
    { id: "relationship-overview", visible: true, expanded: true },
    { id: "interaction-history", visible: true, expanded },
  ];

  it("needs an expand when History is visible and collapsed by its override", () => {
    expect(
      resolveHistoryReveal({
        topLevel: visibleHistory(true),
        collapse: { "interaction-history": false },
      }),
    ).toEqual({ available: true, needsExpand: true, defaultExpanded: true });
  });

  it("needs an expand when History is visible and collapsed by default", () => {
    expect(
      resolveHistoryReveal({ topLevel: visibleHistory(false), collapse: {} }),
    ).toEqual({ available: true, needsExpand: true, defaultExpanded: false });
  });

  it("needs no expand when the override already expands History", () => {
    expect(
      resolveHistoryReveal({
        topLevel: visibleHistory(false),
        collapse: { "interaction-history": true },
      }),
    ).toEqual({ available: true, needsExpand: false, defaultExpanded: false });
  });

  it("needs no expand when History is expanded by default", () => {
    expect(
      resolveHistoryReveal({ topLevel: visibleHistory(true), collapse: {} }),
    ).toEqual({ available: true, needsExpand: false, defaultExpanded: true });
  });

  it("is unavailable when the layout hides History", () => {
    expect(
      resolveHistoryReveal({
        topLevel: [
          { id: "relationship-overview", visible: true, expanded: true },
          { id: "interaction-history", visible: false, expanded: true },
        ],
        collapse: { "interaction-history": false },
      }),
    ).toEqual({ available: false, needsExpand: false, defaultExpanded: false });
  });

  it("is unavailable when the layout has no History placement at all", () => {
    expect(
      resolveHistoryReveal({
        topLevel: [
          { id: "relationship-overview", visible: true, expanded: true },
        ],
        collapse: {},
      }),
    ).toEqual({ available: false, needsExpand: false, defaultExpanded: false });
  });

  it("agrees with the section header's expanded state", () => {
    for (const expanded of [true, false]) {
      for (const override of [undefined, true, false]) {
        const collapse =
          override === undefined ? {} : { "interaction-history": override };
        const header = resolveProfileModuleHostState({
          id: "interaction-history",
          defaultExpanded: expanded,
          collapse,
        });
        expect(
          resolveHistoryReveal({
            topLevel: visibleHistory(expanded),
            collapse,
          }).needsExpand,
        ).toBe(!header.expanded);
      }
    }
  });
});

// D-10: the Profile scrolls to the History header. The header's own y is
// stable across an expand, but a collapsed History at the end of a short
// Profile cannot be scrolled to until its body exists (ScrollView clamps to
// the current content height), so an expanding reveal waits for the expanded
// History layout before it scrolls.
describe("createHistoryRevealScroll", () => {
  function scroller() {
    const scrollTo = vi.fn();
    return { scrollTo, reveal: createHistoryRevealScroll(scrollTo) };
  }

  it("scrolls at once to the host offset plus the History offset when no expand is needed", () => {
    const { scrollTo, reveal } = scroller();
    reveal.hostLayout(320);
    reveal.historyLayout(480, true);
    reveal.reveal(false);
    expect(scrollTo).toHaveBeenCalledExactlyOnceWith(800);
  });

  it("waits for the expanded History layout before scrolling an expanding reveal", () => {
    const { scrollTo, reveal } = scroller();
    reveal.hostLayout(100);
    reveal.historyLayout(200, false);
    reveal.reveal(true);
    expect(scrollTo).not.toHaveBeenCalled();
    // A collapsed-state relayout (e.g. the "Saving…" caption) does not count.
    reveal.historyLayout(200, false);
    expect(scrollTo).not.toHaveBeenCalled();
    reveal.expandSettled(true);
    expect(scrollTo).not.toHaveBeenCalled();
    reveal.historyLayout(200, true);
    expect(scrollTo).toHaveBeenCalledExactlyOnceWith(300);
    // Later History relayouts (rows loading) never scroll again.
    reveal.historyLayout(200, true);
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it("scrolls once whichever of the expanded layout and the settled write lands first", () => {
    const { scrollTo, reveal } = scroller();
    reveal.hostLayout(10);
    reveal.historyLayout(20, false);
    reveal.reveal(true);
    reveal.historyLayout(20, true);
    reveal.expandSettled(true);
    expect(scrollTo).toHaveBeenCalledExactlyOnceWith(30);
  });

  it("still scrolls to the header when the expand write fails", () => {
    const { scrollTo, reveal } = scroller();
    reveal.hostLayout(10);
    reveal.historyLayout(90, false);
    reveal.reveal(true);
    reveal.expandSettled(false);
    expect(scrollTo).toHaveBeenCalledExactlyOnceWith(100);
    reveal.historyLayout(90, true);
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it("tracks the latest measured offsets", () => {
    const { scrollTo, reveal } = scroller();
    reveal.hostLayout(10);
    reveal.historyLayout(20, true);
    reveal.hostLayout(15);
    reveal.historyLayout(45, true);
    reveal.reveal(false);
    expect(scrollTo).toHaveBeenCalledExactlyOnceWith(60);
  });
});
