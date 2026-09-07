import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openTestDb, nodeSqliteExecutor } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import { readOrrerySatellites } from "@/db/orrery-satellites-read";
import { addRelationship, editRelationship, deleteRelationship, restoreRelationship } from "@/db/relationships-dao";
import { mergeContacts } from "@/db/merge-dao";
import { loadOrreryScene, createOrrerySatelliteController, type OrrerySatelliteState } from "@/services/orrery-scene";
import { satelliteContext } from "@/components/orrery/orrery-satellite-context";
vi.mock("expo-sqlite", () => ({}));
const now = "2026-09-07 12:00:00";
let db: ReturnType<typeof openTestDb>;
let exec: ReturnType<typeof nodeSqliteExecutor>;
const parents = [{ id: 1, uid: "p1" }, { id: 2, uid: "p2" }];
beforeEach(async () => {
  db = openTestDb(); exec = nodeSqliteExecutor(db);
  let n = 0;
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, { now, newUid: () => `s${++n}`, defaultPhoneRegion: "US" });
  for (const p of parents) await exec.runAsync("INSERT INTO contacts(id,uid,name,tracking_enabled,interval_days,created_at,modified_at) VALUES(?,?,?,1,30,?,?)", [p.id,p.uid,p.uid,now,now]);
});
afterEach(() => db.close());
const add = (contactId = 1) => addRelationship(exec, { contactId, personName: "👩🏽‍🚀 é 李", relationType: "姉妹", createdAt: now, now });
describe("eligible Orrery relationship projection", () => {
  it("short-circuits empty parents and preserves Unicode/default visibility and deterministic identity order", async () => {
    const read = vi.spyOn(exec, "getAllAsync");
    expect(await readOrrerySatellites(exec, [])).toEqual([]); expect(read).not.toHaveBeenCalled();
    const id = await add(); await add();
    const rows = await readOrrerySatellites(exec, [...parents, parents[0]]);
    expect(rows).toHaveLength(2); expect(rows[0].personName).toBe("👩🏽‍🚀 é 李");
    expect(rows.map(r => r.uid)).toEqual(rows.map(r => r.uid).sort());
    expect(satelliteContext(rows[0], "亲人")).toEqual({ name: "👩🏽‍🚀 é 李", relation: "姉妹 of 亲人" });
    await editRelationship(exec, { id, contactId: 1, relationType: null, now });
    const fallback = (await readOrrerySatellites(exec, parents)).find(r => r.relationType === null)!;
    expect(satelliteContext(fallback,"亲人").relation).toBe("A key person for 亲人");
  });
  it("reflects link/hide/delete/restore and parent lifecycle without contact fabrication", async () => {
    const id = await add();
    for (const patch of [{hidden: 1 as const}, {hidden: 0 as const,linkedContactId: 2}]) {
      await editRelationship(exec,{id,contactId:1,now,...patch}); expect(await readOrrerySatellites(exec,parents)).toEqual([]);
    }
    await editRelationship(exec,{id,contactId:1,now,linkedContactId:null});
    await deleteRelationship(exec,{id,contactId:1,now}); expect(await readOrrerySatellites(exec,parents)).toEqual([]);
    await restoreRelationship(exec,{id,contactId:1,now}); expect(await readOrrerySatellites(exec,parents)).toHaveLength(1);
    for (const sql of ["UPDATE contacts SET tracking_enabled=0 WHERE id=1", "UPDATE contacts SET tracking_enabled=1,archived_at='2026-09-07' WHERE id=1"]) {
      await exec.runAsync(sql); expect(await readOrrerySatellites(exec,parents)).toEqual([]);
    }
  });
  it("rechecks favorites membership and parent UID, with no global sun exception", async () => {
    await add(); await exec.runAsync("UPDATE app_settings SET sun_contact_id=1");
    const system = { kind: "builtin" as const, id: "favorites" as const };
    expect(await readOrrerySatellites(exec,parents,system)).toEqual([]);
    await exec.runAsync("UPDATE contacts SET favourite_rank=0 WHERE id=1");
    expect(await readOrrerySatellites(exec,parents,system)).toHaveLength(1);
    expect(await readOrrerySatellites(exec,[{id:1,uid:"old"}],system)).toEqual([]);
  });
  it("merge clears would-be self links and reparents the same durable relationship", async () => {
    const id = await add(2); await editRelationship(exec,{id,contactId:2,linkedContactId:1,now});
    expect(await readOrrerySatellites(exec,parents)).toEqual([]);
    await mergeContacts(exec,{survivorId:1,absorbedId:2,now});
    const rows = await readOrrerySatellites(exec,parents);
    expect(rows).toHaveLength(1); expect(rows[0].parentId).toBe(1); expect(rows[0].parentUid).toBe("p1");
  });
  it("bounds query batches and distinguishes failures from empty", async () => {
    const getAllAsync = vi.spyOn(exec,"getAllAsync");
    await readOrrerySatellites(exec, Array.from({length:257},(_,i)=>({id:i+1,uid:`p${i+1}`})));
    expect(getAllAsync).toHaveBeenCalledTimes(2);
    getAllAsync.mockRejectedValueOnce(new Error("read failed"));
    await expect(readOrrerySatellites(exec,parents)).rejects.toThrow("read failed");
  });
  it("separate optional generations discard excluded-parent, disabled and out-of-order completions; retry never erases contacts", async () => {
    await add(); const scene = await loadOrreryScene(exec,1);
    const rows = await readOrrerySatellites(exec,parents);
    let resolve!: (rows: typeof rows) => void;
    const load = vi.fn(() => new Promise<typeof rows>(r => {resolve=r;}));
    const states: OrrerySatelliteState[] = [];
    const controller = createOrrerySatelliteController(load,s=>states.push(s));
    const old = controller.reload(scene,true);
    await controller.reload(null,false); resolve(rows); await old;
    expect(states.at(-1)?.rows).toEqual([]);
    load.mockResolvedValueOnce(rows);
    await controller.reload({...scene,generation:2,systemSnapshot:{...scene.systemSnapshot,members:[]}},true);
    expect(states.at(-1)?.rows).toEqual([]);
    load.mockRejectedValueOnce(new Error("optional")); await controller.reload(scene,true);
    expect(states.at(-1)?.status).toBe("error"); expect(scene.contacts).toHaveLength(2);
    load.mockResolvedValueOnce(rows); await controller.reload(scene,true);
    expect(states.at(-1)?.rows).toHaveLength(1);
  });
});
