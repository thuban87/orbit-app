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

/** Every `useFocusEffect(` block, sliced up to the next one (or the render). */
function focusEffectBlocks(): string[] {
  const blocks: string[] = [];
  let from = code.indexOf("useFocusEffect(");
  while (from !== -1) {
    const next = code.indexOf("useFocusEffect(", from + 1);
    blocks.push(code.slice(from, next === -1 ? undefined : next));
    from = next;
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
    expect(claim).toMatch(/\}, \[confirm\]\)/);
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
    expect(code.match(/setPanelOwned\(/g)).toHaveLength(1);
    expect(code.match(/releasePanelOwned\(/g)).toHaveLength(1);
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
