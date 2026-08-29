import { describe, expect, it, vi } from "vitest";
import { resolveWidgetUri } from "@/navigation/widget-linking";
import { guardWidgetIntent } from "./widget-quick-action-guard";

const bound = { archived_at: null, trackingEnabled: 1 };
const unbound = { archived_at: null, trackingEnabled: 0 };
const archived = { archived_at: "2026-08-29", trackingEnabled: 1 };

function lookup(row: typeof bound | null) {
  return vi.fn(async () => row);
}

describe("guardWidgetIntent", () => {
  it("allows a Bound Compose target", async () => {
    const intent = resolveWidgetUri("orbit://compose/7");
    expect(await guardWidgetIntent(intent, lookup(bound))).toEqual(intent);
  });

  it("fails closed for an Unbound Compose target", async () => {
    const guard = lookup(unbound);
    expect(
      await guardWidgetIntent(resolveWidgetUri("orbit://compose/7"), guard),
    ).toBeNull();
    expect(guard).toHaveBeenCalledWith(7);
  });

  it("allows a live Unbound Profile-open target", async () => {
    const intent = resolveWidgetUri("orbit://contact/7");
    expect(await guardWidgetIntent(intent, lookup(unbound))).toEqual(intent);
  });

  it.each([archived, null])(
    "dead-ends either target kind when missing or archived",
    async (row) => {
      expect(
        await guardWidgetIntent(
          resolveWidgetUri("orbit://compose/7"),
          lookup(row),
        ),
      ).toBeNull();
      expect(
        await guardWidgetIntent(
          resolveWidgetUri("orbit://contact/7"),
          lookup(row),
        ),
      ).toBeNull();
    },
  );

  it("keeps the favourites intent independent of a contact lookup", async () => {
    const intent = resolveWidgetUri("orbit://favourites");
    const guard = lookup(null);
    expect(await guardWidgetIntent(intent, guard)).toEqual(intent);
    expect(guard).not.toHaveBeenCalled();
  });

  it("leaves malformed URLs rejected at the strict resolver", () => {
    expect(resolveWidgetUri("orbit://compose/7?forged=true")).toBeNull();
  });
});
