import { DevSettings } from "react-native";

let registered = false;
/** One Orrery perf-fixture action at a time (seed and restore both write). */
let orreryFixtureBusy = false;

/**
 * The re-anchor target the measurement runbook writes with `run-as` to
 * `<app files dir>/orrery-perf/reanchor.json`: `{"offsetDays": n}` plus an
 * optional `"sunContactId"` recorded at seed time. Missing file → offset 0.
 */
async function readOrreryReanchorTarget(): Promise<{
  offsetDays: number;
  expectedSunContactId: number | null;
}> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { File, Paths } =
    require("expo-file-system") as typeof import("expo-file-system");
  const file = new File(Paths.document, "orrery-perf/reanchor.json");
  if (!file.exists) return { offsetDays: 0, expectedSunContactId: null };
  const parsed = JSON.parse(await file.text()) as {
    offsetDays?: unknown;
    sunContactId?: unknown;
  };
  const offsetDays = parsed.offsetDays ?? 0;
  if (typeof offsetDays !== "number" || !Number.isInteger(offsetDays))
    throw new Error(`reanchor.json offsetDays is not a whole number`);
  const sun = parsed.sunContactId ?? null;
  if (sun !== null && typeof sun !== "number")
    throw new Error("reanchor.json sunContactId is not a number or null");
  return { offsetDays, expectedSunContactId: sun };
}

/** Shell ticks per "shell-tick fan-out" probe run (38.4 Plan 15, W3/O-1). */
const UAT_FAN_OUT_TICKS = 20;
/** Fixed spacing between the probe's shell ticks. */
const UAT_FAN_OUT_INTERVAL_MS = 150;

/** Dev menu only. Each action uses synthetic input and logs numeric observations. */
export function registerUatProbes(): void {
  if (!__DEV__ || registered) return;
  registered = true;
  DevSettings.addMenuItem("Enable debug logging", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Logger } =
      require("@/utils/logger") as typeof import("@/utils/logger");
    Logger.setLevel("debug");
    console.log("uat-probe logger level", Logger.getLevel());
  });
  DevSettings.addMenuItem("UAT: fail first sweep hook (next pass)", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { __armUatSweepFault } =
      require("@/services/launch-sweep") as typeof import("@/services/launch-sweep");
    __armUatSweepFault({ failFirstHook: true });
    console.log("uat-probe armed first-hook failure");
  });
  DevSettings.addMenuItem("UAT: slow next sweep pass (8s)", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { __armUatSweepFault } =
      require("@/services/launch-sweep") as typeof import("@/services/launch-sweep");
    __armUatSweepFault({ slowPassMs: 8_000 });
    console.log("uat-probe armed slow pass");
  });
  // 38.3 one-shot read faults (RG-023/RG-026). Inert until a later plan's call
  // site runs `applyUatFault(name)`; `armUatFault` is itself a no-op outside
  // __DEV__.
  DevSettings.addMenuItem("UAT: fail next Digest day read", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { armUatFault } =
      require("@/utils/uat-faults") as typeof import("@/utils/uat-faults");
    armUatFault("digest-day-read", { mode: "reject" });
    console.log("uat-probe armed", "digest-day-read");
  });
  DevSettings.addMenuItem("UAT: delay next Digest day read (5s)", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { armUatFault } =
      require("@/utils/uat-faults") as typeof import("@/utils/uat-faults");
    armUatFault("digest-day-read", { mode: "delay", ms: 5_000 });
    console.log("uat-probe armed", "digest-day-read");
  });
  DevSettings.addMenuItem("UAT: fail next assist queue refresh", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { armUatFault } =
      require("@/utils/uat-faults") as typeof import("@/utils/uat-faults");
    armUatFault("assist-queue-refresh", { mode: "reject" });
    console.log("uat-probe armed", "assist-queue-refresh");
  });
  // 38.4 Plan 15 (W3/O-1): drive the shell-tick fan-out that once released an
  // expo-sqlite statement under a hidden Profile's read. Counts only — the
  // probe never logs contact data; the error count is read off logcat/Metro.
  DevSettings.addMenuItem(
    `UAT: shell-tick fan-out ×${UAT_FAN_OUT_TICKS}`,
    () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { bumpShellRefresh } =
        require("@/stores/shell-refresh-store") as typeof import("@/stores/shell-refresh-store");
      console.log("uat-probe fan-out start", UAT_FAN_OUT_TICKS);
      let ticks = 0;
      const timer = setInterval(() => {
        bumpShellRefresh();
        ticks += 1;
        if (ticks < UAT_FAN_OUT_TICKS) return;
        clearInterval(timer);
        console.log("uat-probe fan-out end", ticks);
      }, UAT_FAN_OUT_INTERVAL_MS);
    },
  );
  DevSettings.addMenuItem("Dump scheduled notifications", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getAllScheduledNotificationsAsync } =
      require("expo-notifications") as typeof import("expo-notifications");
    void getAllScheduledNotificationsAsync().then((entries) => {
      for (const entry of entries.slice(0, 4)) {
        console.log(
          "uat-probe scheduled",
          JSON.stringify({
            identifier: entry.identifier,
            trigger: entry.trigger,
            categoryIdentifier: entry.content.categoryIdentifier,
            title: entry.content.title,
            data: entry.content.data,
          }),
        );
      }
      console.log("uat-probe scheduled count", entries.length);
    });
  });
  DevSettings.addMenuItem("Probe presented notifications", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { dismissNotificationAsync, getPresentedNotificationsAsync } =
      require("expo-notifications") as typeof import("expo-notifications");
    void (async () => {
      const presented = await getPresentedNotificationsAsync();
      for (const notification of presented) {
        const identifier = notification.request.identifier;
        console.log(
          "uat-probe presented",
          JSON.stringify({
            identifier,
            data: notification.request.content.data,
          }),
        );
        if (!identifier.startsWith("decay:")) continue;
        try {
          await dismissNotificationAsync(identifier);
          console.log("uat-probe dismiss resolved", identifier);
        } catch (error) {
          console.log("uat-probe dismiss rejected", identifier, String(error));
        }
      }
      const after = await getPresentedNotificationsAsync();
      console.log(
        "uat-probe presented after",
        JSON.stringify(after.map((n) => n.request.identifier)),
      );
    })();
  });
  // 38.7 Plan 01 (D-56): the Orrery perf fixture — the labs' shared Size cast
  // plus an All Contacts stress set, written through the real DAOs on a test
  // phone. Synthetic data only; the seed module never enters a release bundle.
  DevSettings.addMenuItem(
    "Orrery: seed perf fixture (Size cast + stress)",
    () => {
      if (orreryFixtureBusy) return console.log("orrery-seed busy");
      orreryFixtureBusy = true;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { defaultOrrerySeedDeps, seedOrreryPerfFixture } =
        require("./orrery-seed") as typeof import("./orrery-seed");
      void (async () => {
        try {
          const { getExecutor } =
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            require("@/db/database") as typeof import("@/db/database");
          // seedOrreryPerfFixture logs the `orrery-seed cast=… stress=…` line.
          await seedOrreryPerfFixture(getExecutor(), defaultOrrerySeedDeps);
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { bumpShellRefresh } =
            require("@/stores/shell-refresh-store") as typeof import("@/stores/shell-refresh-store");
          bumpShellRefresh();
        } catch (error) {
          console.log("orrery-seed failed", String(error));
        } finally {
          orreryFixtureBusy = false;
        }
      })();
    },
  );
  DevSettings.addMenuItem(
    "Orrery: restore perf fixture (photos + re-anchor)",
    () => {
      if (orreryFixtureBusy) return console.log("orrery-fixture busy");
      orreryFixtureBusy = true;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const seed = require("./orrery-seed") as typeof import("./orrery-seed");
      void (async () => {
        try {
          const { getExecutor } =
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            require("@/db/database") as typeof import("@/db/database");
          const exec = getExecutor();
          const deps = seed.defaultOrrerySeedDeps;
          const target = await readOrreryReanchorTarget();
          await seed.restoreOrreryPerfFixturePhotos(exec, deps, target);
          const prefs = await seed.restoreOrreryPerfFixturePreferences(
            exec,
            deps,
            target,
          );
          const result = await seed.reanchorOrreryPerfFixture(
            exec,
            deps,
            target,
          );
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { bumpShellRefresh } =
            require("@/stores/shell-refresh-store") as typeof import("@/stores/shell-refresh-store");
          bumpShellRefresh();
          const problems = [...prefs.problems, ...result.problems];
          console.log(
            `orrery-fixture ok=${result.ok && prefs.problems.length === 0} offsetDays=${result.offsetDays} problems=${problems.length ? problems.join(" | ") : "none"}`,
          );
        } catch (error) {
          console.log(
            `orrery-fixture ok=false offsetDays=null problems=${String(error)}`,
          );
        } finally {
          orreryFixtureBusy = false;
        }
      })();
    },
  );
  // 38.7 Plan 08 (D-44/D-49, DEBUG screening only — D-59): flip the render
  // host's spike variants. The canvas reads the host at mount, so leave and
  // re-enter the Orrery tab after a flip. Each logs the effective host.
  const orreryHost = () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const override =
      require("./orrery-host-override") as typeof import("./orrery-host-override");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const host =
      require("@/components/orrery/v2/render-host") as typeof import("@/components/orrery/v2/render-host");
    return { override, host };
  };
  const logOrreryHost = () => {
    const { host } = orreryHost();
    console.log(
      `orrery-dev-host host=${host.describeOrreryHost(host.resolveOrreryRenderHost())}`,
    );
  };
  DevSettings.addMenuItem("Orrery spike: opaque canvas on/off", () => {
    const { override, host } = orreryHost();
    const current = host.resolveOrreryRenderHost();
    override.setOrreryHostOverride({ opaqueCanvas: !current.opaqueCanvas });
    logOrreryHost();
  });
  DevSettings.addMenuItem(
    "Orrery spike: ambient driver frame-clock/interval",
    () => {
      const { override, host } = orreryHost();
      const current = host.resolveOrreryRenderHost();
      override.setOrreryHostOverride({
        ambientDriver:
          current.ambientDriver === "interval" ? "frame-clock" : "interval",
      });
      logOrreryHost();
    },
  );
  DevSettings.addMenuItem("Orrery spike: bake on/off", () => {
    const { override, host } = orreryHost();
    const current = host.resolveOrreryRenderHost();
    override.setOrreryHostOverride({
      bakePath: current.bakePath === "gpu-offscreen" ? "none" : "gpu-offscreen",
    });
    logOrreryHost();
  });
  DevSettings.addMenuItem("Orrery spike: reset host overrides", () => {
    orreryHost().override.clearOrreryHostOverride();
    logOrreryHost();
  });
  // Counts only (no names): the shared text and photo caches, for tuning
  // their caps against the D-11 memory gate (38.7-08 carried-in items).
  DevSettings.addMenuItem("Orrery: log text + photo cache stats", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { orreryTextService } =
      require("@/components/orrery/resources/orrery-text-service") as typeof import("@/components/orrery/resources/orrery-text-service");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { orreryPhotoCache } =
      require("@/components/orrery/resources/orrery-photo-cache") as typeof import("@/components/orrery/resources/orrery-photo-cache");
    console.log(
      `orrery-stats text=${JSON.stringify(orreryTextService.stats())} photo=${JSON.stringify(orreryPhotoCache.stats())}`,
    );
  });
  DevSettings.addMenuItem("Measure backup ingress", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { runIngressMeasure } =
      require("@/services/backup/__dev__/ingress-measure") as typeof import("@/services/backup/__dev__/ingress-measure");
    void runIngressMeasure();
  });
  for (const candidateMiB of [8, 16, 32, 64, 96] as const) {
    DevSettings.addMenuItem(`Measure backup ${candidateMiB} MiB`, () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { runIngressMeasureCandidate } =
        require("@/services/backup/__dev__/ingress-measure") as typeof import("@/services/backup/__dev__/ingress-measure");
      void runIngressMeasureCandidate(candidateMiB);
    });
  }
  DevSettings.addMenuItem("Measure encrypted backup 4 MiB", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { runIngressMeasureEncrypted } =
      require("@/services/backup/__dev__/ingress-measure") as typeof import("@/services/backup/__dev__/ingress-measure");
    void runIngressMeasureEncrypted();
  });
  const cases = [
    "delayed_headers",
    "delayed_body",
    "cancel_after_headers",
    "oversized_body",
    "truncated_body",
    "non_2xx",
  ] as const;
  for (const caseName of cases) {
    DevSettings.addMenuItem(`Secure fetch: ${caseName}`, () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { runSecureFetchProbe } =
        require("@/ai/__dev__/secure-fetch-probe") as typeof import("@/ai/__dev__/secure-fetch-probe");
      void runSecureFetchProbe(caseName, "https://httpbin.org");
    });
  }
}
