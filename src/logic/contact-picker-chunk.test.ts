import { describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({
  isContactPickerAvailable: vi.fn(() => false),
  pickContacts: vi.fn(),
  readAllContacts: vi.fn(),
  listContactsSummary: vi.fn(),
  readContactsByLookupKeys: vi.fn(),
}));
const deletedUris = vi.hoisted((): string[] => []);

vi.mock(
  "../../modules/orbit-contact-picker/src/OrbitContactPickerModule",
  () => ({
    default: native,
  }),
);
vi.mock("expo-file-system", () => ({
  File: class File {
    constructor(private readonly uri: string) {}
    delete() {
      deletedUris.push(this.uri);
    }
  },
}));

import {
  readAllContacts,
  readContactsByLookupKeys,
} from "../../modules/orbit-contact-picker";
import { chunkLookupKeys, mergeSelectedContacts } from "./contact-picker-chunk";

const contact = (lookupKey: string, photoTempUri: string | null = null) => ({
  lookupKey,
  displayName: lookupKey,
  methods: [],
  birthday: null,
  photoTempUri,
});

describe("contact picker chunks", () => {
  it("forms ordered chunks and restores selected order while deduplicating", () => {
    expect(chunkLookupKeys(["a", "b", "c", "d", "e"], 2)).toEqual([
      ["a", "b"],
      ["c", "d"],
      ["e"],
    ]);
    expect(
      mergeSelectedContacts(
        [
          [contact("c"), contact("a")],
          [contact("b"), contact("c")],
        ],
        ["a", "b", "c"],
      ).map((item) => item.lookupKey),
    ).toEqual(["a", "b", "c"]);
  });

  it("short-circuits empty selections without calling native", async () => {
    await expect(readAllContacts([])).resolves.toEqual({
      contacts: [],
      omittedCount: 0,
    });
    await expect(readContactsByLookupKeys([])).resolves.toEqual([]);
    expect(native.readContactsByLookupKeys).not.toHaveBeenCalled();
  });

  it("orchestrates more than one chunk and reports vanished selections", async () => {
    native.readContactsByLookupKeys
      .mockResolvedValueOnce([contact("a"), contact("b")])
      .mockResolvedValueOnce([contact("d")]);

    await expect(readAllContacts(["a", "b", "c", "d"], 2)).resolves.toEqual({
      contacts: [contact("a"), contact("b"), contact("d")],
      omittedCount: 1,
    });
    expect(native.readContactsByLookupKeys).toHaveBeenNthCalledWith(1, [
      "a",
      "b",
    ]);
    expect(native.readContactsByLookupKeys).toHaveBeenNthCalledWith(2, [
      "c",
      "d",
    ]);
  });

  it("removes staged photos from completed chunks before rejecting", async () => {
    native.readContactsByLookupKeys
      .mockResolvedValueOnce([contact("a", "file:///cache/a.photo")])
      .mockRejectedValueOnce(new Error("provider unavailable"));

    await expect(readAllContacts(["a", "b"], 1)).rejects.toThrow(
      "provider unavailable",
    );
    expect(deletedUris).toEqual(["file:///cache/a.photo"]);
  });
});
