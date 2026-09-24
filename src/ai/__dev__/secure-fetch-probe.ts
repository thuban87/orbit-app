import { SecureFetchError, secureCustomFetch } from "@/ai/secure-fetch";

export type SecureFetchProbeCase =
  | "delayed_headers"
  | "delayed_body"
  | "cancel_after_headers"
  | "oversized_body"
  | "non_2xx";

/** Synthetic-only D-20 probe. Host must be a public HTTPS test service; no app data is read. */
export async function runSecureFetchProbe(
  caseName: SecureFetchProbeCase,
  baseUrl: string,
): Promise<{
  caseName: SecureFetchProbeCase;
  outcome: string;
  settleCount: number;
  elapsedMs: number;
}> {
  if (!__DEV__) throw new Error("Debug probe unavailable");
  const base = new URL(baseUrl);
  if (base.protocol !== "https:")
    throw new Error("Public HTTPS test host required");
  const paths: Record<SecureFetchProbeCase, string> = {
    delayed_headers: "/delay/2",
    delayed_body: "/drip?duration=2&numbytes=256",
    cancel_after_headers: "/drip?duration=10&numbytes=1024",
    oversized_body: "/bytes/1048577",
    non_2xx: "/status/503",
  };
  const controller = new AbortController();
  const started = Date.now();
  let settleCount = 0;
  let outcome = "unknown";
  const timer =
    caseName === "cancel_after_headers"
      ? setTimeout(() => controller.abort(), 1_000)
      : undefined;
  try {
    const result = await secureCustomFetch({
      url: new URL(paths[caseName], base).toString(),
      method: "POST",
      headers: {
        Authorization: "Bearer synthetic-probe-only",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ probe: "synthetic" }),
      signal: controller.signal,
    });
    outcome = `http_${result.status}`;
    settleCount++;
  } catch (error) {
    outcome = error instanceof SecureFetchError ? error.code : "unknown";
    settleCount++;
  } finally {
    if (timer) clearTimeout(timer);
  }
  const observation = {
    caseName,
    outcome,
    settleCount,
    elapsedMs: Date.now() - started,
  };
  console.log("secure-fetch-probe", observation);
  return observation;
}
