import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SqlExecutor } from "@/db/types";
import type { RootStackParamList } from "@/navigation/types";
import type { PickedContact } from "../../../modules/orbit-contact-picker";

const { routePickedImport } = vi.hoisted(() => ({
  routePickedImport: vi.fn(),
}));

vi.mock("./import-acquire", () => ({ routePickedImport }));

import { startContactImport } from "./start-contact-import";

const picked: PickedContact[] = [
  {
    lookupKey: "legacy-contact-1",
    displayName: "Ada Lovelace",
    methods: [{ type: "phone", value: "312-555-0100" }],
    birthday: null,
    photoTempUri: null,
  },
];
const exec = {} as SqlExecutor;
const navigate =
  vi.fn() as unknown as NativeStackNavigationProp<RootStackParamList>["navigate"];

describe("startContactImport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends a system picker result through the shared import sink", async () => {
    const pick = vi.fn().mockResolvedValue(picked);

    await startContactImport({
      mode: "system",
      exec,
      effectivePhoneRegion: "US",
      now: "2026-08-30 10:00:00",
      pick,
      navigate,
    });

    expect(pick).toHaveBeenCalledOnce();
    expect(routePickedImport).toHaveBeenCalledWith(
      exec,
      picked,
      { effectivePhoneRegion: "US", now: "2026-08-30 10:00:00" },
      expect.objectContaining({ navigate: expect.any(Function) }),
    );
  });

  it("merges provider notes after an in-context grant (API-37 picker omits notes)", async () => {
    const pick = vi.fn().mockResolvedValue(picked);
    const ensureNotesAccess = vi.fn().mockResolvedValue(true);
    const readByLookupKeys = vi
      .fn()
      .mockResolvedValue([{ ...picked[0], note: "Met at PyCon" }]);

    await startContactImport({
      mode: "system",
      exec,
      effectivePhoneRegion: "US",
      now: "2026-08-30 10:00:00",
      pick,
      ensureNotesAccess,
      readByLookupKeys,
      navigate,
    });

    expect(readByLookupKeys).toHaveBeenCalledWith(["legacy-contact-1"]);
    expect(routePickedImport.mock.calls[0][1]).toEqual([
      { ...picked[0], note: "Met at PyCon" },
    ]);
  });

  it("imports without notes when contacts access is denied", async () => {
    const pick = vi.fn().mockResolvedValue(picked);
    const readByLookupKeys = vi.fn();

    await startContactImport({
      mode: "system",
      exec,
      effectivePhoneRegion: "US",
      now: "2026-08-30 10:00:00",
      pick,
      ensureNotesAccess: vi.fn().mockResolvedValue(false),
      readByLookupKeys,
      navigate,
    });

    expect(readByLookupKeys).not.toHaveBeenCalled();
    expect(routePickedImport.mock.calls[0][1]).toEqual(picked);
  });

  it("never asks for access when the pick is empty or the note read fails", async () => {
    const ensureNotesAccess = vi.fn().mockResolvedValue(true);
    await startContactImport({
      mode: "system",
      exec,
      effectivePhoneRegion: "US",
      now: "2026-08-30 10:00:00",
      pick: vi.fn().mockResolvedValue([]),
      ensureNotesAccess,
      readByLookupKeys: vi.fn(),
      navigate,
    });
    expect(ensureNotesAccess).not.toHaveBeenCalled();

    await startContactImport({
      mode: "system",
      exec,
      effectivePhoneRegion: "US",
      now: "2026-08-30 10:00:00",
      pick: vi.fn().mockResolvedValue(picked),
      ensureNotesAccess,
      readByLookupKeys: vi.fn().mockRejectedValue(new Error("provider")),
      navigate,
    });
    expect(routePickedImport.mock.calls.at(-1)?.[1]).toEqual(picked);
  });

  it("opens the legacy picker without calling the shared sink", async () => {
    const pick = vi.fn().mockResolvedValue(picked);

    await startContactImport({
      mode: "legacy",
      exec,
      effectivePhoneRegion: "US",
      now: "2026-08-30 10:00:00",
      pick,
      navigate,
    });

    expect(pick).not.toHaveBeenCalled();
    expect(routePickedImport).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith("LegacyContactPicker");
  });
});
