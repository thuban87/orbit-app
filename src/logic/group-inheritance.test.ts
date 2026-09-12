import { describe, expect, it } from "vitest";

import {
  computeFollowingChildren,
  resolveDisplay,
} from "@/logic/group-inheritance";

const event = {
  channel: "In Person",
  quality: "Positive",
  duration: 7200,
};

const sarah = {
  channel: "In Person",
  quality: "Negative",
  duration: 7200,
  direction: "outbound",
  connected: 1,
  geFollowChannel: 1,
  geFollowQuality: 0,
  geFollowDuration: 1,
};

const mike = {
  ...sarah,
  quality: "Positive",
  duration: 2700,
  geFollowQuality: 1,
  geFollowDuration: 0,
};

const jordan = {
  ...sarah,
  quality: "Positive",
  duration: 7200,
  geFollowQuality: 1,
  geFollowDuration: 1,
};

describe("Group Event inheritance", () => {
  it("encodes the dossier Tone/Duration inheritance example", () => {
    const changedEvent = { ...event, quality: "Neutral", duration: 10800 };

    expect(resolveDisplay(sarah, changedEvent)).toMatchObject({
      quality: { label: "Tone", value: "Negative", following: false },
      duration: { label: "Duration", value: 10800, following: true },
    });
    expect(resolveDisplay(mike, changedEvent)).toMatchObject({
      quality: { label: "Tone", value: "Neutral", following: true },
      duration: { label: "Duration", value: 2700, following: false },
    });
    expect(resolveDisplay(jordan, changedEvent)).toMatchObject({
      quality: { value: "Neutral", following: true },
      duration: { value: 10800, following: true },
    });
  });

  it("preserves an equal-value override as intentionally detached", () => {
    const detached = { ...jordan, geFollowQuality: 0 };
    expect(resolveDisplay(detached, event).quality).toEqual({
      label: "Tone",
      value: "Positive",
      following: false,
    });
  });

  it("selects only Channel/Tone/Duration followers", () => {
    expect(computeFollowingChildren([sarah, mike, jordan], "quality")).toEqual([
      mike,
      jordan,
    ]);
    expect(computeFollowingChildren([sarah, mike, jordan], "duration")).toEqual(
      [sarah, jordan],
    );
  });

  it("keeps direction and connected participant-owned plain values", () => {
    const display = resolveDisplay(sarah, event);
    expect(display.direction).toEqual({
      label: "Direction",
      value: "outbound",
    });
    expect(display.connected).toEqual({ label: "Connected", value: 1 });
    expect(display.direction).not.toHaveProperty("following");
    expect(display.connected).not.toHaveProperty("following");
  });
});
