import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { listLinks } from "@/db/contact-links-dao";
import { getContactForEdit } from "@/db/contact-read";
import { createContactFull, updateContactFull } from "@/db/contacts-dao";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { listMemoriesForContact } from "@/db/memories-read";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";
import {
  buildEditInput,
  type EditFormState,
  seedEditState,
} from "./edit-contact-logic";
import { runEditContactSave } from "./edit-contact-save-coordinator";

const NOW = "2026-09-23 12:00:00";
let exec: SqlExecutor;
let sequence = 0;
const uid = () => `coordinator-${++sequence}`;

beforeEach(async () => {
  sequence = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: uid,
  });
});

async function setup() {
  const { contactId } = await createContactFull(exec, {
    uid: uid(),
    name: "Alex",
    intervalDays: 30,
    now: NOW,
  });
  const read = await getContactForEdit(exec, contactId, []);
  if (!read) throw new Error("missing contact");
  const form: EditFormState = {
    ...seedEditState(read),
    memories: [
      { id: -1, type: "general", value: "same" },
      { id: -2, type: "general", value: "same" },
    ],
    relationships: [],
    offLimits: [],
  };
  return { contactId, form };
}

function inputFor(
  contactId: number,
  form: EditFormState,
  seededMemories: NonNullable<EditFormState["memories"]> = [],
) {
  return buildEditInput(form, {
    contactId,
    now: NOW,
    interactionUid: uid(),
    editDefs: [],
    neverContacted: true,
    effectivePhoneRegion: null,
    seededMemories,
    seededRelationships: [],
    seededOffLimits: [],
    seededCurrentState: {},
  });
}

const adapters = {
  toMemoryDraft: (
    row: Awaited<ReturnType<typeof listMemoriesForContact>>[number],
  ) => ({ id: row.id, type: row.type, value: row.value }),
  toRelationshipDraft: (row: { id: number; person_name: string }) => ({
    id: row.id,
    personName: row.person_name,
  }),
  toOffLimitsDraft: (row: {
    id: number;
    kind: string;
    text: string | null;
  }) => ({ id: row.id, kind: "off_limits" as const, text: row.text }),
};

describe("runEditContactSave", () => {
  it("surfaces a canonical-duplicate method after both transactions commit", async () => {
    const { contactId, form } = await setup();
    const input = inputFor(contactId, {
      ...form,
      memories: [],
      relationships: [],
      offLimits: [],
    });
    input.methodDrafts = [
      { uid: uid(), type: "phone", value: "312 555 1234" },
      { uid: uid(), type: "phone", value: "+1 312 555 1234" },
    ];
    input.methodNormalization = { effectivePhoneRegion: "US" };
    const outcome = await runEditContactSave({
      exec,
      input,
      submittedForm: form,
      getCurrentForm: () => form,
      submittedLinks: [],
      getCurrentLinks: () => [],
      seededLinks: [],
      seededMemories: [],
      seededRelationships: [],
      seededOffLimits: [],
      initialTrackingEnabled: true,
      neverContacted: true,
      ...adapters,
      refresh: async () => undefined,
    });
    expect(outcome.status).toBe("canonicalDuplicate");
    if (outcome.status === "canonicalDuplicate") {
      expect(outcome.metadata.methods).toHaveLength(1);
    }
  });

  it("preserves edits and a new row made while metadata save is awaited", async () => {
    const { contactId, form } = await setup();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let currentForm = form;
    const pending = runEditContactSave({
      exec,
      input: inputFor(contactId, form),
      submittedForm: form,
      getCurrentForm: () => currentForm,
      submittedLinks: [],
      getCurrentLinks: () => [],
      seededLinks: [],
      seededMemories: [],
      seededRelationships: [],
      seededOffLimits: [],
      initialTrackingEnabled: true,
      neverContacted: true,
      ...adapters,
      writeMetadata: async (executor, input) => {
        await gate;
        return updateContactFull(executor, input);
      },
      refresh: async () => undefined,
    });
    currentForm = {
      ...form,
      memories: [
        { ...form.memories![0], value: "edited in flight" },
        form.memories![1],
        { id: -3, type: "general", value: "new in flight" },
      ],
    };
    release();
    const first = await pending;
    expect(first.status).toBe("saved");
    if (first.status !== "saved") return;
    expect(first.baseline.form.memories?.map((row) => row.value)).toEqual([
      "edited in flight",
      "same",
      "new in flight",
    ]);
    expect(first.baseline.form.memories?.map((row) => row.id)).toEqual([
      expect.any(Number),
      expect.any(Number),
      -3,
    ]);
    const retryInput = inputFor(
      contactId,
      first.baseline.form,
      first.baseline.memories,
    );
    expect(retryInput.memories?.add).toHaveLength(1);
    expect(retryInput.memories?.edit).toHaveLength(1);
    const second = await runEditContactSave({
      exec,
      input: retryInput,
      submittedForm: first.baseline.form,
      getCurrentForm: () => first.baseline.form,
      submittedLinks: [],
      getCurrentLinks: () => [],
      seededLinks: [],
      seededMemories: first.baseline.memories,
      seededRelationships: [],
      seededOffLimits: [],
      initialTrackingEnabled: true,
      neverContacted: true,
      ...adapters,
      refresh: async () => undefined,
    });
    expect(second.status).toBe("saved");
    expect(
      (await listMemoriesForContact(exec, contactId))
        .map((row) => row.value)
        .sort(),
    ).toEqual(["edited in flight", "new in flight", "same"]);
  });

  it("keeps knowledge and link identities stable across a repeated complete save", async () => {
    const { contactId, form } = await setup();
    const richForm: EditFormState = {
      ...form,
      relationships: [{ id: -3, personName: "Sam" }],
      offLimits: [{ id: -4, kind: "off_limits", text: "Private" }],
      lastTalkedAbout: "Plans",
      currentLocation: "Chicago",
    };
    const link = { uid: uid(), url: "https://example.com", label: null };
    const first = await runEditContactSave({
      exec,
      input: inputFor(contactId, richForm),
      submittedForm: richForm,
      getCurrentForm: () => richForm,
      submittedLinks: [link],
      getCurrentLinks: () => [link],
      seededLinks: [],
      seededMemories: [],
      seededRelationships: [],
      seededOffLimits: [],
      initialTrackingEnabled: true,
      neverContacted: true,
      ...adapters,
      refresh: async () => undefined,
    });
    expect(first.status).toBe("saved");
    if (first.status !== "saved") return;
    const memoryUids = (await listMemoriesForContact(exec, contactId)).map(
      (row) => row.uid,
    );
    const linkUids = (await listLinks(exec, contactId)).map((row) => row.uid);
    const next = first.baseline;
    const second = await runEditContactSave({
      exec,
      input: buildEditInput(next.form, {
        contactId,
        now: NOW,
        interactionUid: uid(),
        editDefs: [],
        neverContacted: next.neverContacted,
        effectivePhoneRegion: null,
        seededMemories: next.memories,
        seededRelationships: next.relationships,
        seededOffLimits: next.offLimits,
        seededCurrentState: next.currentState,
      }),
      submittedForm: next.form,
      getCurrentForm: () => next.form,
      submittedLinks: next.linksDraft,
      getCurrentLinks: () => next.linksDraft,
      seededLinks: next.links,
      seededMemories: next.memories,
      seededRelationships: next.relationships,
      seededOffLimits: next.offLimits,
      initialTrackingEnabled: true,
      neverContacted: next.neverContacted,
      ...adapters,
      refresh: async () => undefined,
    });
    expect(second.status).toBe("saved");
    expect(
      (await listMemoriesForContact(exec, contactId)).map((row) => row.uid),
    ).toEqual(memoryUids);
    expect((await listLinks(exec, contactId)).map((row) => row.uid)).toEqual(
      linkUids,
    );
    expect(second.status === "saved" ? second.metadata.addedIds : null).toEqual(
      { memories: [], relationships: [], offLimits: [] },
    );
  });

  it("does not replay committed knowledge and link removals", async () => {
    const { contactId, form } = await setup();
    const link = { uid: uid(), url: "https://remove.example", label: null };
    const first = await runEditContactSave({
      exec,
      input: inputFor(contactId, form),
      submittedForm: form,
      getCurrentForm: () => form,
      submittedLinks: [link],
      getCurrentLinks: () => [link],
      seededLinks: [],
      seededMemories: [],
      seededRelationships: [],
      seededOffLimits: [],
      initialTrackingEnabled: true,
      neverContacted: true,
      ...adapters,
      refresh: async () => undefined,
    });
    expect(first.status).toBe("saved");
    if (first.status !== "saved") return;
    const removedForm = { ...first.baseline.form, memories: [] };
    const second = await runEditContactSave({
      exec,
      input: inputFor(contactId, removedForm, first.baseline.memories),
      submittedForm: removedForm,
      getCurrentForm: () => removedForm,
      submittedLinks: [],
      getCurrentLinks: () => [],
      seededLinks: first.baseline.links,
      seededMemories: first.baseline.memories,
      seededRelationships: [],
      seededOffLimits: [],
      initialTrackingEnabled: true,
      neverContacted: true,
      ...adapters,
      refresh: async () => undefined,
    });
    expect(second.status).toBe("saved");
    if (second.status !== "saved") return;
    const third = await runEditContactSave({
      exec,
      input: inputFor(
        contactId,
        second.baseline.form,
        second.baseline.memories,
      ),
      submittedForm: second.baseline.form,
      getCurrentForm: () => second.baseline.form,
      submittedLinks: second.baseline.linksDraft,
      getCurrentLinks: () => second.baseline.linksDraft,
      seededLinks: second.baseline.links,
      seededMemories: second.baseline.memories,
      seededRelationships: [],
      seededOffLimits: [],
      initialTrackingEnabled: true,
      neverContacted: true,
      ...adapters,
      refresh: async () => undefined,
    });
    expect(third.status).toBe("saved");
    expect(await listMemoriesForContact(exec, contactId)).toEqual([]);
    expect(await listLinks(exec, contactId)).toEqual([]);
  });

  it("maps two identical additions to distinct committed ids and second save adds nothing", async () => {
    const { contactId, form } = await setup();
    const first = await runEditContactSave({
      exec,
      input: inputFor(contactId, form),
      submittedForm: form,
      getCurrentForm: () => form,
      submittedLinks: [],
      getCurrentLinks: () => [],
      seededLinks: [],
      seededMemories: [],
      seededRelationships: [],
      seededOffLimits: [],
      initialTrackingEnabled: true,
      neverContacted: true,
      ...adapters,
      refresh: async () => undefined,
    });
    expect(first.status).toBe("saved");
    if (first.status !== "saved") return;
    const ids = first.baseline.form.memories?.map((row) => row.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    const before = await listMemoriesForContact(exec, contactId);
    const secondForm = first.baseline.form;
    const second = await runEditContactSave({
      exec,
      input: inputFor(contactId, secondForm, first.baseline.memories),
      submittedForm: secondForm,
      getCurrentForm: () => secondForm,
      submittedLinks: [],
      getCurrentLinks: () => [],
      seededLinks: [],
      seededMemories: first.baseline.memories,
      seededRelationships: [],
      seededOffLimits: [],
      initialTrackingEnabled: true,
      neverContacted: first.baseline.neverContacted,
      ...adapters,
      refresh: async () => undefined,
    });
    expect(second.status).toBe("saved");
    expect(
      (await listMemoriesForContact(exec, contactId)).map((row) => row.uid),
    ).toEqual(before.map((row) => row.uid));
  });

  it("advances metadata after link failure and marks a failed refresh stale", async () => {
    const { contactId, form } = await setup();
    const pendingLink = {
      uid: uid(),
      url: "https://retry.example",
      label: null,
    };
    const failedLinks = await runEditContactSave({
      exec,
      input: inputFor(contactId, form),
      submittedForm: form,
      getCurrentForm: () => form,
      submittedLinks: [pendingLink],
      getCurrentLinks: () => [pendingLink],
      seededLinks: [],
      seededMemories: [],
      seededRelationships: [],
      seededOffLimits: [],
      initialTrackingEnabled: true,
      neverContacted: true,
      ...adapters,
      writeLinks: async () => {
        throw new Error("link write failed");
      },
      refresh: async () => undefined,
    });
    expect(failedLinks.status).toBe("linksFailed");
    if (failedLinks.status !== "linksFailed") return;
    const committed = await listMemoriesForContact(exec, contactId);
    const retryForm = failedLinks.baseline.form;
    const failedRefresh = await runEditContactSave({
      exec,
      input: inputFor(contactId, retryForm, failedLinks.baseline.memories),
      submittedForm: retryForm,
      getCurrentForm: () => retryForm,
      submittedLinks: failedLinks.baseline.linksDraft,
      getCurrentLinks: () => failedLinks.baseline.linksDraft,
      seededLinks: failedLinks.baseline.links,
      seededMemories: failedLinks.baseline.memories,
      seededRelationships: [],
      seededOffLimits: [],
      initialTrackingEnabled: true,
      neverContacted: failedLinks.baseline.neverContacted,
      ...adapters,
      refresh: async () => {
        throw new Error("refresh failed");
      },
    });
    expect(failedRefresh.status).toBe("refreshFailed");
    if (failedRefresh.status === "refreshFailed")
      expect(failedRefresh.stale).toBe(true);
    expect((await listLinks(exec, contactId)).map((row) => row.uid)).toEqual([
      pendingLink.uid,
    ]);
    expect(
      (await listMemoriesForContact(exec, contactId)).map((row) => row.uid),
    ).toEqual(committed.map((row) => row.uid));
  });
});
