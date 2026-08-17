/**
 * widget-linking — the strict orbit:// deep-link spine for the home-screen widget
 * (WDG-02/03), the second of this phase's two node-testable correctness cores.
 *
 * Two exports:
 *
 *   1. `resolveWidgetUri(url: unknown)` — the PURE, node-loadable resolver
 *      (mirrors notification-nav.ts: NO react-navigation, NO expo, NO
 *      react-native import at load time). It is a STRICT ALLOW-LIST (V5,
 *      T-12-01): it accepts ONLY the three minted forms
 *        - orbit://contact/<positive-int>   → Profile
 *        - orbit://compose/<positive-int>   → Compose
 *        - orbit://favourites               → ManageFavourites
 *      and returns null for EVERYTHING else — a wrong scheme, an unknown host, a
 *      non-integer / negative / zero / oversized id, a present query string /
 *      fragment / port, an encoded path, an extra segment, or a NON-STRING input.
 *      The launcher-delivered intent is untrusted (it can be spoofed by another
 *      app); the resolver never eval/interpolates it, and the anchored digit-only
 *      regexes make the id impossible to smuggle anything through.
 *
 *      EVERY accepted form resolves to a RESET onto [Home, target] (index 1) —
 *      none is a bare navigate. Under app-wide singleTask the OS may hand us an
 *      arbitrary back-stack, so Back must be a JS concern: resetting onto
 *      [Home, target] guarantees Back always lands on the dashboard, exactly as
 *      notification-nav.ts:63-72 resets the decay tap.
 *
 *      The larger tile's "Log" button reuses orbit://contact/<id> → Profile
 *      (where the one-tap "Log contact" action lives) per the Task-1 owner
 *      ratification (2026-08-17); there is no bespoke Log route.
 *
 *   2. `WidgetLinkingGate({ isReady })` — a render-null gate that turns an
 *      OS-delivered orbit:// URL into a navigation, mirroring ShareIntentGate /
 *      NotificationResponseGate: it subscribes with Linking.addEventListener('url')
 *      (warm) and reads Linking.getInitialURL() once (cold), resolves via
 *      resolveWidgetUri, parks the intent in reactive state, and flushes it onto
 *      navigationRef once `isReady` settles. react-native's Linking and the
 *      navigationRef are pulled in via dynamic import INSIDE the effects so this
 *      module stays node-loadable for the pure resolver's test.
 *
 * We deliberately do NOT add a react-navigation `linking` getInitialURL/subscribe
 * config: a second consumer of the launch intent would race the share-intent
 * singleton (Pitfall 4 / linking.ts:22-33). This gate handles ONLY orbit:// widget
 * deep links and never consumes the share text/plain path (ShareIntentProvider's
 * single-owner job).
 */
import { useEffect, useState } from "react";

/**
 * A serializable RESET intent — the gate applies it verbatim as
 * `navigationRef.current.reset({ index, routes })`. All three forms reset onto
 * [Home, target] (index 1); none is a navigate, so Back always returns to the
 * dashboard. The shapes mirror react-navigation's `reset` argument so the gate is
 * a thin adapter with no branching of its own.
 */
export type WidgetNavIntent =
  | {
      type: "reset";
      index: 1;
      routes: [
        { name: "Home" },
        { name: "Profile"; params: { contactId: number } },
      ];
    }
  | {
      type: "reset";
      index: 1;
      routes: [
        { name: "Home" },
        { name: "Compose"; params: { contactId: number } },
      ];
    }
  | {
      type: "reset";
      index: 1;
      routes: [{ name: "Home" }, { name: "ManageFavourites" }];
    };

/** The one accepted zero-id form. */
const FAVOURITES_URI = "orbit://favourites";

/**
 * Anchored, digit-ONLY forms. `$` rejects a trailing query/fragment/extra
 * segment; `[0-9]+` rejects a negative sign, a decimal point, an encoded `%`,
 * a port (`contact:80/…` has no `/` after the host), and any non-digit — so the
 * only thing that can reach `parseWidgetId` is a run of ASCII digits.
 */
const CONTACT_URI = /^orbit:\/\/contact\/([0-9]+)$/;
const COMPOSE_URI = /^orbit:\/\/compose\/([0-9]+)$/;

/**
 * Parse a digits-only capture to a positive, safe integer contact id, or null.
 * `Number.isSafeInteger` rejects an OVERSIZED id (a 20-digit run parses to a
 * value past 2^53 and fails the check); `id > 0` rejects zero. Because the regex
 * already guaranteed digits-only, `Number()` can only yield a finite integer.
 */
function parseWidgetId(digits: string): number | null {
  const id = Number(digits);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return null;
  }
  return id;
}

/**
 * Resolve an orbit:// widget deep link to a serializable reset intent, or null
 * when the input is not EXACTLY one of the three minted forms. Pure — no
 * navigator, no OS, no side effect. Rejects a non-string input up front so the
 * V5 "reject non-strings" contract is real (the param is `unknown`, not `string`).
 */
export function resolveWidgetUri(url: unknown): WidgetNavIntent | null {
  if (typeof url !== "string") {
    return null;
  }

  if (url === FAVOURITES_URI) {
    return {
      type: "reset",
      index: 1,
      routes: [{ name: "Home" }, { name: "ManageFavourites" }],
    };
  }

  const contact = CONTACT_URI.exec(url);
  if (contact) {
    const id = parseWidgetId(contact[1]);
    return id === null
      ? null
      : {
          type: "reset",
          index: 1,
          routes: [
            { name: "Home" },
            { name: "Profile", params: { contactId: id } },
          ],
        };
  }

  const compose = COMPOSE_URI.exec(url);
  if (compose) {
    const id = parseWidgetId(compose[1]);
    return id === null
      ? null
      : {
          type: "reset",
          index: 1,
          routes: [
            { name: "Home" },
            { name: "Compose", params: { contactId: id } },
          ],
        };
  }

  return null;
}

/**
 * Ready-gated single-owner orbit:// deep-link navigation. Renders null (config/
 * logic only — no colour literals, check:colors).
 *
 * `isReady` is the reactive navigator-readiness flag App.tsx sets from
 * `NavigationContainer`'s `onReady` — the same flag ShareIntentGate /
 * NotificationResponseGate use. A deep link that arrives one tick before the
 * container reports ready is parked in reactive state and flushed the moment
 * `isReady` flips true (and vice-versa), so it is never stranded.
 *
 * react-native's `Linking` and the `navigationRef` are loaded via dynamic import
 * INSIDE the effects, keeping this module node-loadable so `resolveWidgetUri`'s
 * test never pulls in react-native or the react-navigation container ref.
 *
 * Mounted by App.tsx alongside the other gates in 12-07.
 */
export function WidgetLinkingGate({ isReady }: { isReady: boolean }) {
  // An orbit:// intent parked until the navigator is ready. Reactive so the flush
  // effect re-fires the moment EITHER this or `isReady` settles last.
  const [pending, setPending] = useState<WidgetNavIntent | null>(null);

  // WARM: subscribe to url events. COLD: read the launch URL once. Both resolve
  // through the strict allow-list; a non-orbit / share URL yields null (ignored),
  // so this never consumes the share text/plain path.
  useEffect(() => {
    let cancelled = false;
    let sub: { remove: () => void } | undefined;
    void (async () => {
      const { Linking } = await import("react-native");
      if (cancelled) {
        return;
      }
      sub = Linking.addEventListener("url", ({ url }: { url: string }) => {
        const intent = resolveWidgetUri(url);
        if (intent) {
          setPending(intent);
        }
      });
      const initial = await Linking.getInitialURL();
      if (cancelled) {
        return;
      }
      const intent = resolveWidgetUri(initial);
      if (intent) {
        setPending(intent);
      }
    })();
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, []);

  // Flush a queued intent once BOTH it and navigator readiness settle. Every
  // intent is a reset, so the gate is a single reset call with no branching.
  useEffect(() => {
    if (!isReady || pending === null) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const { navigationRef } = await import("./linking");
      if (cancelled) {
        return;
      }
      navigationRef.current?.reset({
        index: pending.index,
        routes: pending.routes,
      });
      setPending(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [isReady, pending]);

  return null;
}
