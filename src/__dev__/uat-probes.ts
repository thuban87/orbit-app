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
          JSON.stringify({ identifier, data: notification.request.content.data }),
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
