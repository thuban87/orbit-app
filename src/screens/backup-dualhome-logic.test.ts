import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FlowNavigator } from "@/navigation/flow-host";

/**
 * 38.12 D-68 (convergence c2 B-8): every restore host kind has an explicit
 * mapping in each helper. A restore host is settings or digest; a Profile is
 * not a restore host and is rejected by the type.
 */
const flowHost = vi.hoisted(() => ({ finishFlow: vi.fn() }));
vi.mock("@/navigation/flow-host", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/navigation/flow-host")>()),
  finishFlow: flowHost.finishFlow,
}));

const {
  backupAppBarVariant,
  DEFAULT_RESTORE_HOST,
  RESTORE_SUCCESS_BASE_ROUTE,
  restoreReturnLabel,
  returnFromRestore,
  shouldConsumeSharedBackup,
} = await import("./backup-dualhome-logic");
type RestoreHost = import("./backup-dualhome-logic").RestoreHost;

const SETTINGS: RestoreHost = { kind: "settings" };
const DIGEST: RestoreHost = { kind: "digest" };

function navigatorSpy() {
  return {
    getState: vi.fn(() => undefined),
    dispatch: vi.fn(),
    goBack: vi.fn(),
    getParent: vi.fn(() => undefined),
  } satisfies FlowNavigator;
}

describe("restore host helpers (38.12 D-68)", () => {
  beforeEach(() => {
    flowHost.finishFlow.mockReset();
  });

  it("defaults to the Settings host", () => {
    expect(DEFAULT_RESTORE_HOST).toEqual({ kind: "settings" });
  });

  describe("shouldConsumeSharedBackup", () => {
    it("settings consumes the shared backup", () => {
      expect(shouldConsumeSharedBackup(SETTINGS)).toBe(true);
    });
    it("digest consumes the shared backup", () => {
      expect(shouldConsumeSharedBackup(DIGEST)).toBe(true);
    });
  });

  describe("backupAppBarVariant", () => {
    it("settings uses the child bar", () => {
      expect(backupAppBarVariant(SETTINGS)).toBe("child");
    });
    it("digest uses the child bar", () => {
      expect(backupAppBarVariant(DIGEST)).toBe("child");
    });
  });

  describe("restore return", () => {
    it("settings returns to the Settings hub, labelled 'Return to Settings'", () => {
      expect(restoreReturnLabel(SETTINGS)).toBe("Return to Settings");
      const navigation = navigatorSpy();
      returnFromRestore(navigation, SETTINGS);
      expect(navigation.dispatch).toHaveBeenCalledWith({
        type: "RESET",
        payload: { index: 0, routes: [{ name: "Settings" }] },
      });
      expect(RESTORE_SUCCESS_BASE_ROUTE).toBe("Settings");
      expect(flowHost.finishFlow).not.toHaveBeenCalled();
    });

    it("digest returns through finishFlow({ kind: 'digest' }), labelled 'Return to Digest'", () => {
      expect(restoreReturnLabel(DIGEST)).toBe("Return to Digest");
      const navigation = navigatorSpy();
      returnFromRestore(navigation, DIGEST);
      expect(flowHost.finishFlow).toHaveBeenCalledWith(navigation, {
        kind: "digest",
      });
      expect(navigation.dispatch).not.toHaveBeenCalled();
    });
  });

  it("rejects a Profile host at the type level", () => {
    const profile = { kind: "profile", profileKey: "Profile-1" } as const;
    // @ts-expect-error a Profile is not a restore host (B-8)
    const host: RestoreHost = profile;
    // Type-checked only, never run: each helper refuses a Profile host.
    const typeOnly = () => {
      // @ts-expect-error a Profile is not a restore host (B-8)
      shouldConsumeSharedBackup(profile);
      // @ts-expect-error a Profile is not a restore host (B-8)
      backupAppBarVariant(profile);
      // @ts-expect-error a Profile is not a restore host (B-8)
      restoreReturnLabel(profile);
      // @ts-expect-error a Profile is not a restore host (B-8)
      returnFromRestore(navigatorSpy(), profile);
    };
    expect(typeof typeOnly).toBe("function");
    expect(host.kind).toBe("profile");
  });
});
