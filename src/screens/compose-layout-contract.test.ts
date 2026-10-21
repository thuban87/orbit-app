/**
 * ComposeScreen layout contract (38.14 D-75, D-44, D-45, D-72, D-42; R4-01).
 * The repo has no react-test-renderer (RESEARCH Pitfall 1), so this source
 * scan pins the screen's structure; keyboard lift, the capped box's nested
 * scroll and the draft-switch prompt are exercised on device in plan 09.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const code = readFileSync(join(__dirname, "ComposeScreen.tsx"), "utf8");

/** The body of `const <name> = useCallback(...)` up to its dependency list. */
function handlerBody(name: string): string {
  const start = code.indexOf(`const ${name} = useCallback(`);
  expect(start).toBeGreaterThan(-1);
  const end = code.indexOf("}, [", start);
  expect(end).toBeGreaterThan(start);
  return code.slice(start, end);
}

describe("Compose keeps Copy and Transmit reachable (D-75)", () => {
  it("renders Copy and Transmit after the content ScrollView closes, in a pinned bar", () => {
    const lastScrollClose = code.lastIndexOf("</ScrollView>");
    expect(lastScrollClose).toBeGreaterThan(-1);
    const bar = code.indexOf('testID="compose-action-bar"');
    expect(bar).toBeGreaterThan(lastScrollClose);
    expect(code.indexOf('testID="compose-copy"')).toBeGreaterThan(bar);
    expect(code.indexOf('testID="compose-transmit"')).toBeGreaterThan(bar);
  });

  it("lifts the screen above the keyboard and otherwise clears the gesture bar", () => {
    expect(code).toContain("keyboardLift(");
    // The keyboard height leaves out the navigation bar; the edge-to-edge root
    // adds it back (38.14-09 DEF-1).
    const call = code.slice(
      code.indexOf("keyboardLift({"),
      code.indexOf("});", code.indexOf("keyboardLift({")),
    );
    expect(call).toContain("bottomInset");
    expect(code).toContain("useFocusedBottomInset(");
    expect(code).toContain('Keyboard.addListener("keyboardDidShow"');
    expect(code).toContain('Keyboard.addListener("keyboardDidHide"');
  });

  it("caps the message box and lets it scroll inside itself, keeping line breaks", () => {
    expect(code).toContain("composeDraftMaxHeight(");
    const input = code.slice(
      code.indexOf('testID="compose-draft-input"'),
      code.indexOf("/>", code.indexOf('testID="compose-draft-input"')),
    );
    expect(input).toContain("multiline");
    expect(input).toContain("scrollEnabled");
    // EntryTextField turns typed line breaks into spaces (RESEARCH Pattern 3).
    expect(code).not.toMatch(/<EntryTextField\b/);
  });
});

describe("Compose labels share one scrim backing (D-44)", () => {
  it("has exactly one ChromeScrim — any change to this count is an owner decision", () => {
    expect(code.match(/<ChromeScrim\b/g)).toHaveLength(1);
  });
});

describe("Copy confirmations are snackbars (D-45)", () => {
  it("both copy handlers confirm through showSnackbar", () => {
    expect(handlerBody("onCopy")).toMatch(
      /showSnackbar\(\{\s*kind: "success",\s*label: "Message copied"/,
    );
    expect(handlerBody("onCopySubject")).toMatch(
      /showSnackbar\(\{\s*kind: "success",\s*label: "Subject copied"/,
    );
  });

  it("the inline copied text and its timer are gone", () => {
    expect(code).not.toContain("flashCopyFeedback");
    expect(code).not.toContain("copyTimer");
    expect(code).not.toContain("compose-copied");
    expect(handlerBody("onCopy")).not.toContain("setTimeout(");
    expect(handlerBody("onCopySubject")).not.toContain("setTimeout(");
  });
});

/** The first `useFocusEffect(` block (the load effect), up to the next one. */
function loadFocusEffect(): string {
  const start = code.indexOf("useFocusEffect(");
  expect(start).toBeGreaterThan(-1);
  const next = code.indexOf("useFocusEffect(", start + 1);
  return code.slice(start, next === -1 ? undefined : next);
}

/** The lifecycle's injected `resolvePrompt:` body, up to `generate:`. */
function resolvePromptBody(): string {
  const start = code.indexOf("resolvePrompt: async (");
  expect(start).toBeGreaterThan(-1);
  const end = code.indexOf("generate: (", start);
  expect(end).toBeGreaterThan(start);
  return code.slice(start, end);
}

describe("Opening Compose for another person over a typed draft asks first (D-72)", () => {
  it("the load focus effect gates startSession on the standard discard prompt", () => {
    const effect = loadFocusEffect();
    expect(effect).toContain("shouldPromptDraftSwitch(");
    expect(effect).toContain("askDraftSwitch(");
    expect(effect.indexOf("shouldPromptDraftSwitch(")).toBeLessThan(
      effect.indexOf("askDraftSwitch("),
    );
    // The effect never calls single-flight confirmDiscard() directly: its
    // immediate false is not the user's "Keep editing" (review A-WR-05).
    expect(effect).not.toContain("confirmDiscard(");
    expect(code).toMatch(
      /const askDraftSwitch = createSharedDraftSwitchPrompt\(confirmDiscard\);/,
    );
    expect(code).toMatch(
      /import \{ confirmDiscard \} from "@\/navigation\/discard-keep-guard"/,
    );
  });

  it("Keep editing restores the stored person and clears origin, so Back returns to the dashboard (R3-03)", () => {
    expect(loadFocusEffect()).toMatch(
      /setParams\(\{\s*contactId: storedContactId,\s*origin: undefined,?\s*\}\)/,
    );
  });

  it("AI context is read for the on-screen person at request time (R4-01)", () => {
    expect(code).toContain("contactIdRef.current = contactId;");
    const body = resolvePromptBody();
    expect(body).toContain("const requestContactId = contactIdRef.current;");
    expect(body).toContain("readPromptContext(exec, requestContactId)");
    expect(body).toContain("readComposeResearch(exec, requestContactId)");
    expect(body).not.toContain("readPromptContext(exec, contactId)");
    expect(body).not.toContain("readComposeResearch(exec, contactId)");
    expect(code.match(/readPromptContext\(exec, contactId\)/g)).toBeNull();
    // Only the focus effect's Research count reads the route param directly.
    expect(code.match(/readComposeResearch\(exec, contactId\)/g)).toHaveLength(
      1,
    );
  });
});

describe("Add a phone number or email opens Edit at Contact Methods (D-42)", () => {
  it("navigates Edit with focusSection methods", () => {
    expect(code).toMatch(
      /navigation\.navigate\("Edit", \{\s*contactId,\s*focusSection: "methods",?\s*\}\)/,
    );
  });
});
