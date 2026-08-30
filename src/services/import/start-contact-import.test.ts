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
