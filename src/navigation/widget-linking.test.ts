/**
 * widget-linking — proof that the orbit:// deep-link resolver is a PURE,
 * strict, node-loadable allow-list (WDG-02/03). It accepts ONLY the three
 * minted forms and maps each to a RESET onto [Home, target] (index 1) so Back
 * always lands on the dashboard under app-wide singleTask — mirroring
 * notification-nav.ts's reset discipline. Everything else — a wrong scheme,
 * an unknown host, a non-integer / negative / zero / oversized id, a query
 * string, a fragment, a port, an encoded path, an extra segment, or a
 * non-string input — routes NOWHERE (null). The OS-delivered intent is
 * untrusted (V5); the resolver never eval/interpolates it.
 *
 * The WidgetLinkingGate (which reaches react-native's Linking + navigationRef)
 * is device-only and is NOT exercised here — only the pure resolver is imported,
 * so this stays node-loadable.
 */
import { describe, expect, it, vi } from "vitest";
import {
  resolveWidgetUri,
  subscribeToWidgetUrls,
  type WidgetUrlLinking,
} from "./widget-linking";

describe("resolveWidgetUri — accepted forms (all RESET onto [Home, target])", () => {
  it("maps orbit://contact/<id> to a reset onto [Home, Profile{contactId}]", () => {
    expect(resolveWidgetUri("orbit://contact/123")).toEqual({
      type: "reset",
      index: 1,
      routes: [
        { name: "Home" },
        { name: "Profile", params: { contactId: 123 } },
      ],
    });
  });

  it("maps orbit://compose/<id> to a reset onto [Home, Compose{contactId}]", () => {
    expect(resolveWidgetUri("orbit://compose/7")).toEqual({
      type: "reset",
      index: 1,
      routes: [
        { name: "Home" },
        { name: "Compose", params: { contactId: 7 } },
      ],
    });
  });

  it("maps orbit://reach/<id> to a reset onto [Home, Profile{openReachOut}]", () => {
    expect(resolveWidgetUri("orbit://reach/5")).toEqual({
      type: "reset",
      index: 1,
      routes: [
        { name: "Home" },
        { name: "Profile", params: { contactId: 5, openReachOut: true } },
      ],
    });
  });

  it("maps orbit://favourites to a Home-only reset", () => {
    const intent = resolveWidgetUri("orbit://favourites");
    expect(intent).toEqual({
      type: "reset",
      index: 0,
      routes: [{ name: "Home" }],
    });
    // Explicitly assert it is a reset, never a bare navigate.
    expect(intent?.type).toBe("reset");
  });

  it("routes the ratified 'Log' action (orbit://contact/<id> → Profile)", () => {
    // Task-1 owner ratification: the larger-tile 'Log' button reuses the contact
    // form — no bespoke Log route exists.
    expect(resolveWidgetUri("orbit://contact/42")?.routes[1]).toEqual({
      name: "Profile",
      params: { contactId: 42 },
    });
  });
});

describe("resolveWidgetUri — malformed / untrusted input → null", () => {
  const rejected: Array<[string, unknown]> = [
    ["non-integer id", "orbit://contact/12.5"],
    ["alpha id", "orbit://contact/abc"],
    ["negative id", "orbit://contact/-5"],
    ["zero id", "orbit://contact/0"],
    ["oversized id", "orbit://contact/99999999999999999999"],
    ["missing id", "orbit://contact/"],
    ["no id segment", "orbit://contact"],
    ["extra path segment", "orbit://contact/5/6"],
    ["wrong scheme (http)", "http://contact/5"],
    ["wrong scheme (orbitx)", "orbitx://contact/5"],
    ["unknown host", "orbit://unknown/5"],
    ["profile host (not a real form)", "orbit://profile/5"],
    ["query string on contact", "orbit://contact/5?x=1"],
    ["query string on favourites", "orbit://favourites?x=1"],
    ["fragment", "orbit://contact/5#frag"],
    ["port", "orbit://contact:80/5"],
    ["encoded path", "orbit://contact/%35"],
    ["favourites with trailing slash", "orbit://favourites/"],
    ["favourites with extra segment", "orbit://favourites/5"],
    ["reach missing id", "orbit://reach/"],
    ["reach zero id", "orbit://reach/0"],
    ["reach negative id", "orbit://reach/-1"],
    ["reach alpha id", "orbit://reach/abc"],
    ["reach oversized id", "orbit://reach/99999999999999999999"],
    ["empty string", ""],
    ["number input", 123],
    ["object input", {}],
    ["null input", null],
    ["undefined input", undefined],
    ["boolean input", true],
  ];

  it.each(rejected)("returns null for %s", (_label, input) => {
    expect(resolveWidgetUri(input)).toBeNull();
  });

  it("keeps reach separate from contact and compose forms", () => {
    expect(resolveWidgetUri("orbit://reach/5")?.routes[1]).toEqual({
      name: "Profile",
      params: { contactId: 5, openReachOut: true },
    });
    expect(resolveWidgetUri("orbit://contact/5")?.routes[1]).toEqual({
      name: "Profile",
      params: { contactId: 5 },
    });
    expect(resolveWidgetUri("orbit://compose/5")?.routes[1]).toEqual({
      name: "Compose",
      params: { contactId: 5 },
    });
  });
});

describe("subscribeToWidgetUrls", () => {
  it("keeps a warm widget intent when the launch URL resolves later", async () => {
    let resolveInitial: ((url: string | null) => void) | undefined;
    const initialUrl = new Promise<string | null>((resolve) => {
      resolveInitial = resolve;
    });
    let urlListener: ((event: { url: string }) => void) | undefined;
    const remove = vi.fn();
    const linking: WidgetUrlLinking = {
      addEventListener: vi.fn((_event, listener) => {
        urlListener = listener;
        return { remove };
      }),
      getInitialURL: vi.fn(() => initialUrl),
    };
    const enqueue = vi.fn();
    const unsubscribe = subscribeToWidgetUrls(linking, enqueue);

    urlListener?.({ url: "orbit://contact/8" });
    resolveInitial?.("orbit://compose/7");
    await initialUrl;
    await Promise.resolve();

    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith({
      type: "reset",
      index: 1,
      routes: [
        { name: "Home" },
        { name: "Profile", params: { contactId: 8 } },
      ],
    });
    unsubscribe();
    expect(remove).toHaveBeenCalledOnce();
  });
});
