import { DevSettings } from "react-native";

let registered = false;

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
