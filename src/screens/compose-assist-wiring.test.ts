/**
 * ComposeScreen "Did you send it?" wiring (38.14 D-23, D-77, D-78; tests per
 * D-48). The repo has no react-test-renderer (RESEARCH Pitfall 1), so the panel
 * state machine is node-tested in `compose-assist-panel.test.ts` and the store
 * in `assist-store.test.ts`; this source scan pins how the screen connects them.
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

/** Every `useFocusEffect(` call, sliced up to its closing `  );` line. */
function focusEffectBlocks(): string[] {
  const blocks: string[] = [];
  let from = code.indexOf("\n  useFocusEffect(");
  while (from !== -1) {
    const end = code.indexOf("\n  );\n", from);
    expect(end).toBeGreaterThan(from);
    blocks.push(code.slice(from, end));
    from = code.indexOf("\n  useFocusEffect(", end);
  }
  return blocks;
}

describe("ComposeScreen assist panel wiring", () => {
  it("imports markAssistDismissed and runs it through the one assist runner (D-78, D-08)", () => {
    expect(code).toMatch(
      /markAssistDismissed,\s*markAssistLogged,?\s*\}\s*from "@\/db\/interaction-assist-dao"/,
    );
    const dismiss = handlerBody("onConfirmDismiss");
    expect(dismiss).toContain("runAssistAction(");
    expect(dismiss).toMatch(/write: \(\) =>\s*markAssistDismissed\(/);
    expect(dismiss).toContain("publishAssistDismissal(");
    expect(dismiss).toContain('composePanelOutcome("dismiss", result)');
  });

  it("renders the panel through ComposeConfirmPanel with all three answers wired", () => {
    expect(code).toContain("<ComposeConfirmPanel");
    expect(code).toMatch(/onYes=\{\(\) => void onConfirmYes\(\)\}/);
    expect(code).toMatch(/onDismiss=\{\(\) => void onConfirmDismiss\(\)\}/);
    expect(code).toContain("onLater={onConfirmLater}");
    // The old inline panel and its "Not yet" answer are gone.
    expect(code).not.toContain("onConfirmNotYet");
    expect(code).not.toContain("compose-confirm-not-yet");
  });

  it("Later defers the record BEFORE closing the panel, then takes the later exit (D-77)", () => {
    const later = handlerBody("onConfirmLater");
    const defer = later.indexOf("deferUntilReturn(");
    const close = later.indexOf("setConfirm(null)");
    expect(defer).toBeGreaterThan(-1);
    expect(close).toBeGreaterThan(defer);
    expect(later.indexOf('performExit("later")')).toBeGreaterThan(close);
    // Later writes nothing.
    expect(later).not.toContain("runAssistAction(");
  });

  it("claims and releases the panel record in ONE focus effect keyed on confirm (D-23)", () => {
    const claimBlocks = focusEffectBlocks().filter((block) =>
      block.includes("setPanelOwned("),
    );
    expect(claimBlocks).toHaveLength(1);
    const [claim] = claimBlocks;
    expect(claim).toContain("releasePanelOwned(");
    expect(claim).toMatch(/\}, \[confirm, panelCanShow\]\)/);
    // Held only while the panel can show (review A-IN-01).
    expect(claim).toMatch(/if \(confirm === null \|\| !panelCanShow\) \{/);
    expect(code).toMatch(
      /const panelCanShow = screenState !== "error" && screenState !== "missing";/,
    );
    expect(claim.indexOf("releasePanelOwned(")).toBeGreaterThan(
      claim.indexOf("return () =>"),
    );
  });

  it("each claim re-reads the record's status and closes a panel answered elsewhere (review A-WR-01)", () => {
    const [claim] = focusEffectBlocks().filter((block) =>
      block.includes("setPanelOwned("),
    );
    expect(code).toMatch(
      /import \{ readAssistStatus \} from "@\/db\/interaction-assist-read";/,
    );
    const read = claim.indexOf("readAssistStatus(getExecutor(), assistUid)");
    expect(read).toBeGreaterThan(claim.indexOf("setPanelOwned("));
    expect(claim).toMatch(/if \(live && status !== "pending"\)/);
    expect(claim).toMatch(
      /current\?\.assistUid === assistUid \? null : current/,
    );
    // The cleanup stops a late read from closing a later panel.
    expect(claim.indexOf("live = false;")).toBeGreaterThan(
      claim.indexOf("return () =>"),
    );
  });

  it("no answer handler claims or releases on its own; the focus effect does", () => {
    for (const name of [
      "onConfirmYes",
      "onConfirmDismiss",
      "onConfirmLater",
      "applyPanelOutcome",
    ]) {
      const body = handlerBody(name);
      expect(body).not.toContain("setPanelOwned(");
      expect(body).not.toContain("releasePanelOwned(");
    }
    // The focus effect plus one synchronous claim beside setConfirm in
    // onTransmit (review A-IN-03); only the focus effect releases.
    expect(code.match(/setPanelOwned\(/g)).toHaveLength(2);
    expect(code.match(/releasePanelOwned\(/g)).toHaveLength(1);
    const transmit = handlerBody("onTransmit");
    expect(transmit).toMatch(
      /setPanelOwned\(outcome\.assistUid\);\s*panelScrollPendingRef\.current = true;\s*setConfirm\(\{ assistUid: outcome\.assistUid, channel: usable \}\);/,
    );
    expect(transmit).not.toContain("releasePanelOwned(");
  });

  it("Yes confirms with the logged snackbar naming channel and person (D-43)", () => {
    expect(handlerBody("onConfirmYes")).toContain(
      'composePanelOutcome("yes", result)',
    );
    expect(handlerBody("applyPanelOutcome")).toContain(
      "composeLoggedSnackbar(channel, personName)",
    );
  });

  it("Transmit waits while a panel answer is being written (review A-IN-12)", () => {
    expect(handlerBody("onTransmit")).toMatch(
      /if \(sending \|\| logging \|\| header === null \|\| body\.trim\(\) === ""\)/,
    );
    const transmit = code.slice(code.indexOf('testID="compose-transmit"'));
    expect(transmit).toMatch(
      /disabled=\{sending \|\| logging \|\| availability\.transmitDisabled\}/,
    );
  });
});

describe("the panel is seen when it appears, with the keyboard closed (D-89)", () => {
  it("keeps the panel last in the page's ScrollView", () => {
    const slot = code.indexOf('testID="compose-confirm-slot"');
    expect(slot).toBeGreaterThan(-1);
    expect(code.indexOf("<ComposeConfirmPanel")).toBeGreaterThan(slot);
    // Nothing but the panel's closers sits between it and the end of the
    // column; the pinned bar stays outside the ScrollView (D-75).
    const tail = code.slice(slot, code.lastIndexOf("</ScrollView>"));
    expect(tail).toMatch(/\) : null\}\s*<\/ChromeScrim>\s*$/);
  });

  it("scrolls to the panel once, on its first layout after Transmit opens it", () => {
    expect(code).toMatch(
      /<ScrollView\s+ref=\{scrollRef\}\s+testID="compose-screen"/,
    );
    expect(code).toMatch(
      /testID="compose-confirm-slot" onLayout=\{onPanelLayout\}/,
    );
    const layout = handlerBody("onPanelLayout");
    expect(layout).toContain("if (!panelScrollPendingRef.current) return;");
    expect(
      layout.indexOf("panelScrollPendingRef.current = false;"),
    ).toBeLessThan(layout.indexOf("scrollToEnd("));
    // The only place the pending flag is armed is beside the panel opening.
    expect(code.match(/panelScrollPendingRef\.current = true;/g)).toHaveLength(
      1,
    );
  });

  it("Transmit lets go of the message box before the handoff", () => {
    const transmit = handlerBody("onTransmit");
    const dismiss = transmit.indexOf("Keyboard.dismiss();");
    expect(dismiss).toBeGreaterThan(-1);
    expect(dismiss).toBeLessThan(transmit.indexOf("performReachOut("));
    // After the empty-body and in-flight guards, so a refused tap keeps focus.
    expect(dismiss).toBeGreaterThan(transmit.indexOf("setSending(true);"));
  });

  it("on return to Orbit while the panel shows, scrolls it back and closes the keyboard", () => {
    const blocks = focusEffectBlocks().filter((block) =>
      block.includes('AppState.addEventListener("change"'),
    );
    expect(blocks).toHaveLength(1);
    const [onReturn] = blocks;
    expect(onReturn).toContain("if (!panelShown) return undefined;");
    expect(onReturn).toContain('if (next !== "active") return;');
    expect(onReturn).toContain("Keyboard.dismiss();");
    expect(onReturn).toContain("scrollToEnd(");
    expect(onReturn).toContain("sub.remove()");
    expect(code).toMatch(
      /const panelShown = confirm !== null && panelCanShow;/,
    );
  });
});
