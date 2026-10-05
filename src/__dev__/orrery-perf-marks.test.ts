/**
 * 38.7-15 (DEBUG marks): the switch clock is open only from a tap to that
 * switch's end, so a settle that is no switch (a warm return's reload) never
 * logs `switch:settled` against an old tap.
 */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  beginSwitch,
  endSwitch,
  markSwitch,
  switchOpen,
} from "./orrery-perf-marks";

let lines: string[] = [];
beforeEach(() => {
  lines = [];
  vi.spyOn(console, "log").mockImplementation((line: unknown) => {
    lines.push(String(line));
  });
});
afterEach(() => {
  vi.restoreAllMocks();
});

it("logs switch marks only between the tap and the switch's end", () => {
  endSwitch("stale"); // nothing open: silent
  markSwitch("settled");
  expect(lines).toEqual([]);
  beginSwitch();
  expect(switchOpen()).toBe(true);
  markSwitch("load-done");
  endSwitch("settled");
  expect(switchOpen()).toBe(false);
  // A later settled publication (warm return reload): no line.
  markSwitch("settled");
  endSwitch("settled");
  expect(lines.map((line) => line.replace(/ \d+$/, ""))).toEqual([
    "orrery-perf switch:tap",
    "orrery-perf switch:load-done",
    "orrery-perf switch:settled",
  ]);
});
