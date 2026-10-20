/**
 * Logging forms contract (38.14 plan 04; D-34, D-60, D-61, D-58, D-39).
 *
 * Source scans for wiring a node test cannot render: the three logging forms
 * keep the focused field above the keyboard through 38.10's primitives, the
 * multi-line notes keep a raw TextInput (line breaks survive), the channel
 * options come from the SAVED value, an empty History day seeds the current
 * time, Edit interaction's save confirms and publishes, and the two
 * "What happened?" placeholders are distinct.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");
const read = (path: string): string => readFileSync(join(ROOT, path), "utf8");

const HOSTS = [
  "src/screens/LogInteractionScreen.tsx",
  "src/screens/EditInteractionScreen.tsx",
  "src/screens/GroupLogScreen.tsx",
] as const;

/** The `placeholder="…"` of the TextInput whose testID / label is given. */
function placeholderNear(source: string, marker: string): string | null {
  const at = source.indexOf(marker);
  if (at < 0) return null;
  const end = source.indexOf("/>", at);
  const region = source.slice(at, end);
  return region.match(/placeholder="([^"]*)"/)?.[1] ?? null;
}

describe("keyboard centring on the three logging forms (D-34)", () => {
  it.each(HOSTS)("%s runs the centring hook and provider", (path) => {
    const source = read(path);
    expect(source).toContain("useKeyboardCentering(");
    expect(source).toContain("<KeyboardCenteringProvider value={centering}>");
    expect(source).toContain("{bottomSpacer}");
    expect(source).toMatch(/ref=\{scrollRef\}/);
    expect(source).toMatch(/innerViewRef=\{contentRef\}/);
  });

  it("the refine form's note and custom minutes tell the nearest host on focus and blur", () => {
    const form = read("src/components/TouchpointRefineForm.tsx");
    expect(form).toContain("useKeyboardCenteringContext()");
    expect(form).toContain("onFieldFocus(noteInputRef)");
    expect(form).toContain("onFieldBlur(noteInputRef)");
    expect(form).toContain("onFieldFocus(customMinutesRef)");
    expect(form).toContain("onFieldBlur(customMinutesRef)");
    // The multi-line note keeps a raw TextInput, so typed line breaks survive.
    expect(form).not.toContain("EntryTextField");
  });

  it("Group Log's title and Group Note tell the host on focus and blur", () => {
    const screen = read("src/screens/GroupLogScreen.tsx");
    expect(screen).toContain("centering.onFieldFocus(titleInputRef)");
    expect(screen).toContain("centering.onFieldBlur(titleInputRef)");
    expect(screen).toContain("centering.onFieldFocus(groupNoteInputRef)");
    expect(screen).toContain("centering.onFieldBlur(groupNoteInputRef)");
    expect(screen).not.toContain("EntryTextField");
  });

  it("the provider's scope note names this phase's three forms", () => {
    const provider = read("src/components/ui/KeyboardCenteringProvider.tsx");
    expect(provider).toContain("38.14 D-34");
  });
});

describe("channel options come from the saved value (D-60)", () => {
  it("each host passes its options", () => {
    expect(read("src/screens/EditInteractionScreen.tsx")).toContain(
      "channelOptions={channelOptionsFor(savedChannel)}",
    );
    expect(read("src/screens/EditGroupEventScreen.tsx")).toContain(
      "channelOptions={channelOptionsFor(event.channel)}",
    );
    expect(read("src/screens/GroupLogScreen.tsx")).toContain(
      "channelOptions={ORDINARY_LOG_CHANNEL_OPTIONS}",
    );
    expect(read("src/components/group/ParticipantOverrideEditor.tsx")).toMatch(
      /channelOptions=\{channelOptionsFor\(\s*participantDraft\(participant, event\)\.value\.channel,?\s*\)\}/,
    );
  });

  it("Edit interaction keeps the loaded row's channel, not the draft's", () => {
    const screen = read("src/screens/EditInteractionScreen.tsx");
    expect(screen).toContain("setSavedChannel(loaded.channel)");
    expect(screen).not.toContain("channelOptionsFor(value.channel)");
  });
});

describe("empty History day seeds the current time (D-61)", () => {
  it("Log Interaction seeds through seedOccurredAtForDay, never midnight", () => {
    const screen = read("src/screens/LogInteractionScreen.tsx");
    expect(screen).toContain("seedOccurredAtForDay(prefillDate, now)");
    expect(screen).not.toContain("00:00:00");
  });
});

describe("Edit interaction save confirms and publishes (D-58)", () => {
  it("shows 'Changes saved' and bumps the shell refresh after the write", () => {
    const screen = read("src/screens/EditInteractionScreen.tsx");
    const write = screen.indexOf("await editTouchpointFull(");
    const notify = screen.indexOf("notifyWidgetDataChanged();", write);
    const bump = screen.indexOf("bumpShellRefresh();", write);
    const snackbar = screen.indexOf('label: "Changes saved"', write);
    const back = screen.indexOf("navigation.goBack();", write);
    expect(write).toBeGreaterThan(-1);
    for (const at of [notify, bump, snackbar]) {
      expect(at).toBeGreaterThan(write);
      expect(at).toBeLessThan(back);
    }
  });
});

describe("the two 'What happened?' placeholders are distinct (D-39)", () => {
  it("Group Log's title and the post-log note read differently", () => {
    const groupTitle = placeholderNear(
      read("src/screens/GroupLogScreen.tsx"),
      'testID="group-log-title"',
    );
    const postLog = placeholderNear(
      read("src/components/PostLogNoteEditor.tsx"),
      'accessibilityLabel="Note for the logged interaction"',
    );
    expect(groupTitle).not.toBeNull();
    expect(postLog).not.toBeNull();
    expect(groupTitle).not.toBe(postLog);
  });
});
