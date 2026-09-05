import { describe, expect, it, vi } from "vitest";
import { resolveWidgetUri } from "@/navigation/widget-linking";
import { guardWidgetIntent } from "./widget-quick-action-guard";

const bound = { archived_at: null, trackingEnabled: 1 };
const unbound = { archived_at: null, trackingEnabled: 0 };
const archived = { archived_at: "2026-08-29", trackingEnabled: 1 };
type Contact = { archived_at: string | null; trackingEnabled: number };

function lookup(row: Contact | null) {
  return vi.fn(async () => row);
}

describe("guardWidgetIntent", () => {
  it("allows a Bound Compose target", async () => {
    const intent = resolveWidgetUri("orbit://compose/7");
    expect(await guardWidgetIntent(intent, lookup(bound))).toEqual({
      ok: true,
      intent,
    });
  });

  it("fails closed for an Unbound Compose target", async () => {
    const guard = lookup(unbound);
    expect(
      await guardWidgetIntent(resolveWidgetUri("orbit://compose/7"), guard),
    ).toEqual({ ok: false, reason: "ineligible" });
    expect(guard).toHaveBeenCalledWith(7);
  });

  it("allows a live Unbound Profile-open target", async () => {
    const intent = resolveWidgetUri("orbit://contact/7");
    expect(await guardWidgetIntent(intent, lookup(unbound))).toEqual({
      ok: true,
      intent,
    });
  });

  it("reports missing and archived targets distinctly", async () => {
    expect(
      await guardWidgetIntent(
        resolveWidgetUri("orbit://reach/7"),
        lookup(null),
      ),
    ).toEqual({ ok: false, reason: "missing" });
    expect(
      await guardWidgetIntent(
        resolveWidgetUri("orbit://reach/7"),
        lookup(archived),
      ),
    ).toEqual({ ok: false, reason: "archived" });
  });

  it("keeps the Home-only favourites intent independent of a contact lookup", async () => {
    const intent = resolveWidgetUri("orbit://favourites");
    const guard = lookup(null);
    expect(await guardWidgetIntent(intent, guard)).toEqual({
      ok: true,
      intent,
    });
    expect(guard).not.toHaveBeenCalled();
  });

  it("leaves malformed URLs rejected at the strict resolver", () => {
    expect(resolveWidgetUri("orbit://compose/7?forged=true")).toBeNull();
  });
});
