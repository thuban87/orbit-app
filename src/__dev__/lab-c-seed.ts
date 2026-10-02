/**
 * ORRERY LAB C — synthetic Orrery fixture (experiment/orrery-3d).
 *
 * DEV-ONLY, LAB-C-ONLY. App.tsx `require`s this module only inside
 * `if (__DEV__)` (Metro folds the branch away in release bundles), and the
 * seed itself no-ops unless the running applicationId is `com.bwales.orbit.labc`
 * — the real app never runs it.
 *
 * Everything is written through the app's own write paths, so the recency
 * single-writer (ADR-010 `recomputeLastContact`) derives status from
 * interactions; nothing here touches `last_contact` directly:
 *   - `createContactWithInteraction` (contact + optional first interaction)
 *   - `recordTouchpoint` (older history → gravity tiers)
 *   - `setContactPhoto` (procedural portraits under the `avatars/` contract)
 *   - `addRelationship` (unlinked relationships → Orrery satellites)
 *   - `saveSystemDefinition` (custom Systems via include overrides)
 *   - `updateAppSettings` (turn Relationship Satellites on)
 *
 * Note: `createContactWithInteraction` writes no custom-field pairs. A fresh
 * lab install has no custom-field definitions, so the D-03 pair matrix is
 * trivially complete; do not reuse this seed on a DB that has definitions.
 *
 * Idempotent: skipped when the "Lab C Dense" System already exists.
 *
 * Size comparison Systems (`seedLabCSizesIfAbsent`, 2026-10-02): a dedicated
 * 120-contact cast with the same spec as Lab A (`seed-lab-a.py`) and Lab B
 * (`lab-b-seed.ts`), and the Systems "Size 32" / "Size 120" (first N cast
 * members; Lab A/B also carry Size 5/10/20). Idempotent by "Size 32", so an
 * already-seeded install gains them on its next debug launch.
 * Procedural portrait pixels are fixture IMAGE content, so their colours are
 * computed numerically (Float32Array), never UI colour tokens.
 */
import { ImageFormat, Skia } from "@shopify/react-native-skia";
import Constants from "expo-constants";
import { Directory, File, Paths } from "expo-file-system";
import { updateAppSettings } from "@/db/app-settings-dao";
import { setContactPhoto } from "@/db/contacts-dao";
import { getExecutor, localDateTime } from "@/db/database";
import {
  createContactWithInteraction,
  recordTouchpoint,
} from "@/db/recency-dao";
import { addRelationship } from "@/db/relationships-dao";
import { listCustomSystems, saveSystemDefinition } from "@/db/systems-dao";
import { newUid } from "@/db/uid";
import { bumpShellRefresh } from "@/stores/shell-refresh-store";

// --- Tunables -----------------------------------------------------------------
export const LAB_C_PACKAGE = "com.bwales.orbit.labc";
/** Total synthetic contacts (All Contacts). 200 = the spike's high-count scene. */
export const LAB_C_CONTACT_COUNT = 200;
/** "Lab C Core": the first N, hand-varied recency mix. */
const CORE_SIZE = 40;
/** "Lab C Dense": the first N contacts. */
const DENSE_SIZE = 120;
/** "Lab C Inner": every 12th contact. */
const INNER_STRIDE = 12;
const PHOTO_STRIDE = 3; // every 3rd contact gets a procedural portrait
const PHOTO_PX = 256;
const SATELLITE_PARENTS = 24;
const MAX_HISTORY = 10;
const DENSE_NAME = "Lab C Dense";

const FIRST = [
  "Ava",
  "Ben",
  "Chloé",
  "Dmitri",
  "Elif",
  "Farah",
  "Gus",
  "Hana",
  "Idris",
  "Jun",
  "Kofi",
  "Lena",
  "Mateo",
  "Nia",
  "Oskar",
  "Priya",
  "Quinn",
  "Rosa",
  "Sami",
  "Tove",
  "Uma",
  "Viktor",
  "Wren",
  "Xiu",
  "Yara",
  "Zeke",
];
const LAST = [
  "Abara",
  "Brandt",
  "Castellanos",
  "Dube",
  "Eriksen",
  "Fujita",
  "Galloway",
  "Haddad",
  "Ibsen",
  "Jovanović",
  "Kaur",
  "Lindqvist",
  "Mbeki",
  "Novak",
  "Okafor",
  "Petrov",
];
/** Label-shaping probes (spike check 4): non-Latin + emoji + long names. */
const SPECIAL_NAMES: Record<number, string> = {
  1: "王小明",
  4: "Zoë Ångström-Øverli",
  7: "Priya 🌟 Nair",
  10: "Алексей Волков",
  13: "Maximiliana Montgomery-Featherstonehaugh",
  16: "سارا",
};
const RELATIONS = [
  "Partner",
  "Child",
  "Parent",
  "Sibling",
  "Friend",
  "Colleague",
];
const MOON_NAMES = ["Alex", "Bea", "Cy", "Dana", "Eli", "Fin", "Gia", "Hal"];
const INTERVALS = [7, 14, 21, 30, 45, 60, 90, 180];

function hash(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function nameFor(i: number): string {
  return (
    SPECIAL_NAMES[i] ??
    `${FIRST[i % FIRST.length]} ${LAST[Math.floor(i / FIRST.length + i) % LAST.length]}`
  );
}

/**
 * Target progress (elapsed / interval) by contact index, spread over every
 * status band: stable < 0.8, wobble [0.8,1), decay [1,3), rogue ≥ 3, plus
 * never-contacted (null).
 */
function progressFor(i: number): number | null {
  const r = hash(i + 500);
  if (i % 10 === 9) return null; // ~10% never contacted
  if (r < 0.45) return 0.05 + hash(i + 900) * 0.7;
  if (r < 0.6) return 0.82 + hash(i + 901) * 0.15;
  if (r < 0.88) return 1.05 + hash(i + 902) * 1.9;
  return 3.2 + hash(i + 903) * 2;
}

function daysAgo(now: Date, days: number, hour: number): string {
  const d = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hour,
    0,
    0,
  );
  d.setDate(d.getDate() - days);
  return localDateTime(d);
}

/** Procedural head-and-shoulders portrait, 256 px JPEG bytes (CPU raster). */
function portraitBytes(seed: number): Uint8Array | null {
  const surface = Skia.Surface.Make(PHOTO_PX, PHOTO_PX);
  if (!surface) return null;
  const canvas = surface.getCanvas();
  const c = (r: number, g: number, b: number) => Float32Array.of(r, g, b, 1);
  const h = hash(seed + 7);
  const bgTop = c(
    0.2 + 0.6 * h,
    0.3 + 0.5 * hash(seed + 8),
    0.5 + 0.4 * hash(seed + 9),
  );
  const bgBottom = c(
    0.1 + 0.3 * hash(seed + 10),
    0.1 + 0.3 * h,
    0.2 + 0.3 * hash(seed + 11),
  );
  const bg = Skia.Paint();
  bg.setShader(
    Skia.Shader.MakeLinearGradient(
      { x: 0, y: 0 },
      { x: 0, y: PHOTO_PX },
      [bgTop, bgBottom],
      null,
      0,
    ),
  );
  canvas.drawRect(Skia.XYWHRect(0, 0, PHOTO_PX, PHOTO_PX), bg);
  const skinTone = 0.25 + 0.6 * hash(seed + 12);
  const skin = Skia.Paint();
  skin.setColor(c(skinTone + 0.15, skinTone * 0.85 + 0.05, skinTone * 0.7));
  const shirt = Skia.Paint();
  shirt.setColor(c(hash(seed + 13), hash(seed + 14) * 0.8, hash(seed + 15)));
  const hair = Skia.Paint();
  const hairTone = 0.05 + 0.5 * hash(seed + 16);
  hair.setColor(c(hairTone * 1.2, hairTone * 0.9, hairTone * 0.6));
  canvas.drawOval(Skia.XYWHRect(38, 176, 180, 150), shirt);
  canvas.drawRect(Skia.XYWHRect(108, 150, 40, 40), skin);
  canvas.drawOval(Skia.XYWHRect(74, 50, 108 + 10 * hash(seed + 17), 120), hair);
  canvas.drawOval(Skia.XYWHRect(82, 70, 92, 108), skin);
  const eye = Skia.Paint();
  eye.setColor(c(0.08, 0.08, 0.1));
  canvas.drawCircle(110, 118, 5, eye);
  canvas.drawCircle(146, 118, 5, eye);
  surface.flush();
  const image = surface.makeImageSnapshot();
  const bytes = image.encodeToBytes(ImageFormat.JPEG, 88);
  image.dispose();
  surface.dispose?.();
  return bytes;
}

let running = false;

export async function seedLabCFixtureIfAbsent(): Promise<void> {
  const pkg = Constants.expoConfig?.android?.package;
  if (pkg !== LAB_C_PACKAGE || running) return;
  running = true;
  const exec = getExecutor();
  const t0 = Date.now();
  try {
    const systems = await listCustomSystems(exec);
    if (systems.some((s) => s.name === DENSE_NAME)) {
      console.log("[lab-c-seed] already seeded; skipping");
      await seedLabCSizesIfAbsent();
      return;
    }
    const nowDate = new Date();
    const now = localDateTime(nowDate);
    const ids: number[] = [];
    let touchpoints = 0;
    let photos = 0;
    let moons = 0;
    for (let i = 0; i < LAB_C_CONTACT_COUNT; i++) {
      const interval = INTERVALS[Math.floor(hash(i + 100) * INTERVALS.length)];
      const progress = progressFor(i);
      const lastDays =
        progress === null ? 0 : Math.max(1, Math.round(progress * interval));
      const created = await createContactWithInteraction(exec, {
        uid: newUid(),
        name: nameFor(i),
        intervalDays: interval,
        now,
        rarelyResponds: i % 37 === 5 ? 1 : 0,
        firstInteraction:
          progress === null
            ? undefined
            : {
                uid: newUid(),
                occurredAt: daysAgo(nowDate, lastDays, 9),
                channel: ["Message", "Call", "In Person"][i % 3],
                direction: "mutual",
              },
      });
      const contactId = created.contactId;
      ids.push(contactId);
      if (progress !== null) {
        touchpoints++;
        // Older history: spreads gravity tiers (thin..deep).
        const history = Math.floor(hash(i + 300) ** 2 * MAX_HISTORY);
        for (let k = 1; k <= history; k++) {
          await recordTouchpoint(exec, {
            contactId,
            uid: newUid(),
            occurredAt: daysAgo(nowDate, lastDays + k * interval, 10),
            now,
            channel: ["Message", "Call", "In Person"][(i + k) % 3],
          });
          touchpoints++;
        }
      }
      if (i % PHOTO_STRIDE === 0) {
        const bytes = portraitBytes(i);
        if (bytes) {
          const relative = `avatars/contact-${contactId}.jpg`;
          new Directory(Paths.document, "avatars").create({
            idempotent: true,
            intermediates: true,
          });
          const file = new File(Paths.document, relative);
          if (file.exists) file.delete();
          file.create();
          file.write(bytes);
          await setContactPhoto(exec, contactId, relative, now);
          photos++;
        }
      }
      if (i % Math.floor(LAB_C_CONTACT_COUNT / SATELLITE_PARENTS) === 2) {
        const count = 1 + Math.floor(hash(i + 700) * 3);
        for (let m = 0; m < count; m++) {
          await addRelationship(exec, {
            contactId,
            personName: MOON_NAMES[(i + m) % MOON_NAMES.length],
            relationType: RELATIONS[(i + m) % RELATIONS.length],
            createdAt: now,
            now,
          });
          moons++;
        }
      }
    }
    const system = (name: string, members: number[]) =>
      saveSystemDefinition(exec, {
        systemRef: null,
        name,
        rules: [],
        overrideIntent: members.map((contactId) => ({
          contactId,
          mode: "include" as const,
        })),
        prunableExclusionContactIds: [],
        now,
      });
    await system("Lab C Core", ids.slice(0, CORE_SIZE));
    await system(
      "Lab C Inner",
      ids.filter((_, i) => i % INNER_STRIDE === 0),
    );
    await system(DENSE_NAME, ids.slice(0, DENSE_SIZE));
    await updateAppSettings(exec, { orrerySatellitesEnabled: 1 }, now);
    bumpShellRefresh();
    await seedLabCSizesIfAbsent();
    console.log(
      `[lab-c-seed] seeded contacts=${ids.length} touchpoints=${touchpoints} photos=${photos} satellites=${moons} in ${Date.now() - t0}ms`,
    );
  } catch (error) {
    console.warn("[lab-c-seed] failed", error);
  } finally {
    running = false;
  }
}

// --- Size comparison Systems (shared spec with Lab A / Lab B) -----------------
// Integer-only hashing so the Python (Lab A) and TS implementations agree.
const SIZE_SYSTEMS = [32, 120] as const;
const SIZE_CAST = 120;
const SIZE_FIRST = [
  "Aiden",
  "Bianca",
  "Callum",
  "Daria",
  "Emeka",
  "Freya",
  "Gideon",
  "Helena",
  "Ines",
  "Jonah",
  "Keira",
  "Luca",
  "Maren",
  "Nolan",
  "Odette",
  "Pavel",
  "Rania",
  "Silas",
  "Talia",
  "Ulrich",
  "Vesna",
  "Wade",
  "Ximena",
  "Yusuf",
];
const SIZE_LAST = [
  "Ashworth",
  "Bellamy",
  "Carver",
  "Delacroix",
  "Esposito",
  "Fairbanks",
  "Gallagher",
  "Hargrove",
  "Iwasaki",
  "Jaramillo",
  "Kessler",
  "Lombardi",
  "Mercer",
  "Nakamura",
  "Oduya",
];
const SIZE_INTERVALS = [7, 14, 21, 30, 45, 60, 90];
/** per-10: S stable, W wobble, D decay, R rogue (rarely responds), N never, O rogue (overdue). */
const SIZE_PATTERN = "SWDRNSSWDO";
const SIZE_MOONS: Record<number, [string, string][]> = {
  11: [
    ["Mara", "Partner"],
    ["Theo", "Child"],
  ],
  17: [["Ilse", "Sibling"]],
  26: [["Ruth", "Parent"]],
  70: [
    ["Owen", "Friend"],
    ["Lia", "Partner"],
  ],
};

function sizeH(i: number, salt: number): number {
  return (((i + 1) * 7919 + salt * 104729) % 1000) / 1000;
}

function sizeBand(days: number, interval: number, rarely: number): string {
  const p = days / interval;
  if (rarely && p >= 1) return "R";
  if (p >= 3) return "O";
  if (p >= 1) return "D";
  if (p >= 0.8) return "W";
  return "S";
}

function sizeSpec(i: number) {
  const kind = SIZE_PATTERN[i % 10];
  const interval = SIZE_INTERVALS[(i * 3 + Math.floor(i / 10)) % 7];
  const name = `${SIZE_FIRST[i % 24]} ${SIZE_LAST[(i + 3 * Math.floor(i / 24)) % 15]}`;
  const photo = i % 3 === 1;
  const moons = SIZE_MOONS[i] ?? [];
  if (kind === "N")
    return { name, interval, days: null, rarely: 0, history: 0, photo, moons };
  const h = sizeH(i, 1);
  const rarely = kind === "R" ? 1 : 0;
  const p = {
    S: 0.1 + 0.6 * h,
    W: 0.82 + 0.15 * h,
    D: 1.1 + 1.7 * h,
    R: 1.2 + 1.2 * h,
    O: 3.3 + 1.5 * h,
  }[kind] as number;
  let days = Math.max(1, Math.floor(p * interval + 0.5));
  const order = "SWDO";
  for (let n = 0; n < 400; n += 1) {
    const got = sizeBand(days, interval, rarely);
    if (got === kind) break;
    if (kind === "R" || order.indexOf(got) < order.indexOf(kind)) days += 1;
    else days = Math.max(1, days - 1);
  }
  return {
    name,
    interval,
    days,
    rarely,
    history: Math.floor(sizeH(i, 3) * 6),
    photo,
    moons,
  };
}

async function seedLabCSizesIfAbsent(): Promise<void> {
  const exec = getExecutor();
  const systems = await listCustomSystems(exec);
  if (systems.some((s) => s.name === `Size ${SIZE_SYSTEMS[0]}`)) {
    console.log("[lab-c-seed] size systems already present");
    return;
  }
  const t0 = Date.now();
  const nowDate = new Date();
  const now = localDateTime(nowDate);
  const channels = ["Message", "Call", "In Person"];
  const ids: number[] = [];
  let photos = 0;
  let moons = 0;
  for (let i = 0; i < SIZE_CAST; i++) {
    const spec = sizeSpec(i);
    const created = await createContactWithInteraction(exec, {
      uid: newUid(),
      name: spec.name,
      intervalDays: spec.interval,
      now,
      rarelyResponds: spec.rarely,
      firstInteraction:
        spec.days === null
          ? undefined
          : {
              uid: newUid(),
              occurredAt: daysAgo(nowDate, spec.days, 9),
              channel: channels[i % 3],
              direction: "outbound",
              connected: 1,
            },
    });
    const contactId = created.contactId;
    ids.push(contactId);
    if (spec.days !== null)
      for (let k = 1; k <= spec.history; k++)
        await recordTouchpoint(exec, {
          contactId,
          uid: newUid(),
          occurredAt: daysAgo(
            nowDate,
            spec.days + k * spec.interval,
            9 + (k % 8),
          ),
          now,
          channel: channels[(i + k) % 3],
          direction: "outbound",
          connected: 1,
        });
    if (spec.photo) {
      const bytes = portraitBytes(10_000 + i);
      if (bytes) {
        const relative = `avatars/contact-${contactId}.jpg`;
        new Directory(Paths.document, "avatars").create({
          idempotent: true,
          intermediates: true,
        });
        const file = new File(Paths.document, relative);
        if (file.exists) file.delete();
        file.create();
        file.write(bytes);
        await setContactPhoto(exec, contactId, relative, now);
        photos++;
      }
    }
    for (const [personName, relationType] of spec.moons) {
      await addRelationship(exec, {
        contactId,
        personName,
        relationType,
        createdAt: now,
        now,
      });
      moons++;
    }
  }
  for (const size of SIZE_SYSTEMS)
    await saveSystemDefinition(exec, {
      systemRef: null,
      name: `Size ${size}`,
      rules: [],
      overrideIntent: ids.slice(0, size).map((contactId) => ({
        contactId,
        mode: "include" as const,
      })),
      prunableExclusionContactIds: [],
      now,
    });
  bumpShellRefresh();
  console.log(
    `[lab-c-seed] size systems seeded contacts=${ids.length} photos=${photos} satellites=${moons} in ${Date.now() - t0}ms`,
  );
}
