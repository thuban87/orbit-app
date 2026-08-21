/**
 * NODE-SIDE PROOF ONLY. These tests mock the native `orbit-secure-fetch` module
 * entirely, so they prove the JS wrapper's validation / cancellation / error-
 * sanitization / normalization logic — NOT native transport behavior. The
 * airtight HTTPS→private-address rejection, redirect refusal, and proxy pin are
 * native OkHttp guarantees a mocked-fetch test CANNOT establish; those are proven
 * on a physical Pixel in Plan 06's on-device fixture. Do not read a green run
 * here as evidence the transport-level egress guard works.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const nativeRequest = vi.fn();
const nativeCancel = vi.fn();

vi.mock("../../modules/orbit-secure-fetch", () => ({
  request: (...args: unknown[]) => nativeRequest(...args),
  cancel: (...args: unknown[]) => nativeCancel(...args),
}));

import { SecureFetchError, secureCustomFetch } from "./secure-fetch";

const OK_URL = "https://api.example.com/v1/chat";
const OK_HOST = "api.example.com";

function nativeErr(code: string): Error & { code: string } {
  const e = new Error("native failure") as Error & { code: string };
  e.code = code;
  return e;
}

function okResult(overrides: Record<string, unknown> = {}) {
  return {
    status: 200,
    ok: true,
    bodyText: '{"choices":[]}',
    finalUrlHost: OK_HOST,
    ...overrides,
  };
}

beforeEach(() => {
  nativeRequest.mockReset();
  nativeCancel.mockReset();
});

describe("secureCustomFetch — pre-validation (URL-literal layer, defense-in-depth)", () => {
  it("rejects a non-HTTPS endpoint without touching native", async () => {
    await expect(
      secureCustomFetch({ url: "http://api.example.com/v1" }),
    ).rejects.toMatchObject({ code: "invalid_endpoint" });
    expect(nativeRequest).not.toHaveBeenCalled();
  });

  it("rejects an empty / unconfigured endpoint", async () => {
    await expect(secureCustomFetch({ url: "" })).rejects.toMatchObject({
      code: "invalid_endpoint",
    });
    expect(nativeRequest).not.toHaveBeenCalled();
  });

  it("rejects a private IP-literal endpoint at the JS layer", async () => {
    await expect(
      secureCustomFetch({ url: "https://127.0.0.1/v1" }),
    ).rejects.toMatchObject({ code: "invalid_endpoint" });
    expect(nativeRequest).not.toHaveBeenCalled();
  });
});

describe("secureCustomFetch — success normalization", () => {
  it("normalizes a native success to { status, ok, bodyText }", async () => {
    nativeRequest.mockResolvedValue(okResult());
    const res = await secureCustomFetch({ url: OK_URL });
    expect(res).toEqual({ status: 200, ok: true, bodyText: '{"choices":[]}' });
    expect(nativeRequest).toHaveBeenCalledTimes(1);
    const arg = nativeRequest.mock.calls[0][0] as { requestId: string; url: string };
    expect(typeof arg.requestId).toBe("string");
    expect(arg.url).toBe(OK_URL);
  });

  it("passes a non-ok status through without throwing", async () => {
    nativeRequest.mockResolvedValue(okResult({ status: 500, ok: false }));
    const res = await secureCustomFetch({ url: OK_URL });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(500);
  });
});

describe("secureCustomFetch — sanitized error mapping", () => {
  const cases: Array<[string, string]> = [
    ["ERR_REDIRECT", "redirect"],
    ["ERR_PRIVATE_ADDRESS", "private_address"],
    ["ERR_TRANSPORT", "transport"],
    ["ERR_TIMEOUT", "timeout"],
    ["unsupported_platform", "unsupported_platform"],
  ];

  for (const [nativeCode, mapped] of cases) {
    it(`maps native ${nativeCode} → ${mapped}`, async () => {
      nativeRequest.mockRejectedValue(nativeErr(nativeCode));
      const err = await secureCustomFetch({ url: OK_URL }).catch((e) => e);
      expect(err).toBeInstanceOf(SecureFetchError);
      expect(err.code).toBe(mapped);
    });
  }

  it("maps an unknown native code to a generic transport error", async () => {
    nativeRequest.mockRejectedValue(nativeErr("SOMETHING_WEIRD"));
    const err = await secureCustomFetch({ url: OK_URL }).catch((e) => e);
    expect(err).toBeInstanceOf(SecureFetchError);
    expect(err.code).toBe("transport");
  });

  it("never leaks the endpoint, body, or headers in the error message", async () => {
    nativeRequest.mockRejectedValue(nativeErr("ERR_TRANSPORT"));
    const err = (await secureCustomFetch({
      url: OK_URL,
      headers: { Authorization: "Bearer super-secret-token" },
      body: '{"prompt":"private contact data"}',
    }).catch((e) => e)) as SecureFetchError;
    expect(err.message).not.toContain(OK_HOST);
    expect(err.message).not.toContain("super-secret-token");
    expect(err.message).not.toContain("private contact data");
    expect(err.message).toBe("transport");
  });
});

describe("secureCustomFetch — host mismatch (defense-in-depth)", () => {
  it("rejects when the native finalUrlHost differs from the requested host", async () => {
    nativeRequest.mockResolvedValue(okResult({ finalUrlHost: "evil.example.net" }));
    const err = await secureCustomFetch({ url: OK_URL }).catch((e) => e);
    expect(err).toBeInstanceOf(SecureFetchError);
    expect(err.code).toBe("host_mismatch");
  });
});

describe("secureCustomFetch — abort / cancellation", () => {
  it("issues native cancel and rejects when the signal aborts in flight", async () => {
    let rejectNative: (e: unknown) => void = () => {};
    nativeRequest.mockImplementation(
      () => new Promise((_res, rej) => { rejectNative = rej; }),
    );
    const ac = new AbortController();
    const p = secureCustomFetch({ url: OK_URL, signal: ac.signal });
    ac.abort();
    // native then rejects because the Call was cancelled
    rejectNative(nativeErr("ERR_CANCELLED"));
    const err = await p.catch((e) => e);
    expect(err).toBeInstanceOf(SecureFetchError);
    expect(err.code).toBe("cancelled");
    expect(nativeCancel).toHaveBeenCalledTimes(1);
    expect(typeof nativeCancel.mock.calls[0][0]).toBe("string");
  });

  it("never issues a native request for an already-aborted signal", async () => {
    const ac = new AbortController();
    ac.abort();
    const err = await secureCustomFetch({ url: OK_URL, signal: ac.signal }).catch(
      (e) => e,
    );
    expect(err).toBeInstanceOf(SecureFetchError);
    expect(err.code).toBe("cancelled");
    expect(nativeRequest).not.toHaveBeenCalled();
    expect(nativeCancel).not.toHaveBeenCalled();
  });

  it("issues NO cancel when the signal aborts AFTER the request settled (C3-M4)", async () => {
    nativeRequest.mockResolvedValue(okResult());
    const ac = new AbortController();
    const res = await secureCustomFetch({ url: OK_URL, signal: ac.signal });
    expect(res.ok).toBe(true);
    // Later abort of the same signal must NOT reach native (listener removed).
    ac.abort();
    expect(nativeCancel).not.toHaveBeenCalled();
  });

  it("consumes a post-abort native rejection without an unhandled rejection", async () => {
    let rejectNative: (e: unknown) => void = () => {};
    nativeRequest.mockImplementation(
      () => new Promise((_res, rej) => { rejectNative = rej; }),
    );
    const ac = new AbortController();
    const p = secureCustomFetch({ url: OK_URL, signal: ac.signal });
    ac.abort();
    // A transport-flavoured native rejection arriving after abort still maps to
    // cancelled (abort wins) and is fully awaited — no unhandled rejection.
    rejectNative(nativeErr("ERR_TRANSPORT"));
    await expect(p).rejects.toMatchObject({ code: "cancelled" });
  });
});
