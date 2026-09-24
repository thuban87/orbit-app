import { beforeEach, describe, expect, it, vi } from "vitest";

const { secureCustomFetch } = vi.hoisted(() => ({
  secureCustomFetch: vi.fn(),
}));

vi.mock("@/ai/secure-fetch", () => ({ secureCustomFetch }));

import { runSecureFetchProbe } from "./secure-fetch-probe";

beforeEach(() => {
  vi.stubGlobal("__DEV__", true);
  secureCustomFetch.mockReset();
  secureCustomFetch.mockResolvedValue({ status: 200, ok: true, bodyText: "" });
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("debug secure-fetch probe routes", () => {
  it("uses GET for the public drip endpoint with synthetic input only", async () => {
    await runSecureFetchProbe("delayed_body", "https://httpbin.org");

    expect(secureCustomFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://httpbin.org/drip?duration=2&numbytes=256&delay=0",
        method: "GET",
        headers: { "X-Orbit-Probe": "synthetic-only" },
      }),
    );
    expect(secureCustomFetch.mock.calls[0][0]).not.toHaveProperty("body");
  });

  it("requests more than the native 1 MiB cap from an uncapped host", async () => {
    await runSecureFetchProbe("oversized_body", "https://httpbin.org");

    expect(secureCustomFetch.mock.calls[0][0].url).toBe(
      "https://speed.cloudflare.com/__down?bytes=1048577",
    );
  });
});
