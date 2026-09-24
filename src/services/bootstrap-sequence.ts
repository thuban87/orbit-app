import { Logger } from "@/utils/logger";

/** Keep the durable readiness gates fail-closed while containing image recovery. */
export async function runBootstrapSequence<T>({
  openAndMigrate,
  hydrateThemeAtBoot,
  loadAppFonts,
  reconcileBackgrounds,
}: {
  openAndMigrate: () => Promise<unknown>;
  hydrateThemeAtBoot: () => Promise<T>;
  loadAppFonts: () => Promise<unknown>;
  reconcileBackgrounds: () => Promise<{ failed: number }>;
}): Promise<T> {
  await openAndMigrate();
  const [settings] = await Promise.all([
    hydrateThemeAtBoot(),
    loadAppFonts(),
    reconcileBackgrounds()
      .then(({ failed }) => {
        if (failed > 0)
          Logger.error("bootstrap", "background reconciliation incomplete");
      })
      .catch(() => {
        Logger.error("bootstrap", "background reconciliation failed");
      }),
  ]);
  return settings;
}
