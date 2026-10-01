/**
 * ORRERY LAB B — synthetic Orrery fixture (experiment/orrery-skia-unleashed).
 *
 * DEV-ONLY, LAB-B-ONLY. Never runs in a release build (`__DEV__`) and never runs
 * in the real app: it is gated on the Lab B applicationId
 * (`com.bwales.orbit.labb`). It seeds a representative, fully synthetic dataset
 * through the app's own DAOs so every invariant writer is respected:
 *
 *   - ~140 contacts with varied cadences and interaction histories (gravity
 *     tiers thin..deep, mixed overdue/healthy recency);
 *   - procedural "photo" avatars for ~40% of them (Skia CPU raster -> JPEG,
 *     stored under the normal `avatars/contact-<id>.jpg` contract);
 *   - WP-1.4: 30 contacts instead get one of the 16 fictional, AI-generated
 *     TEST PORTRAITS (`docs/experiments/orrery-renderer/lab-b-skia-unleashed/
 *     assets/test-portraits/`, see its PROVENANCE.md) through the same photo
 *     contract, so face readability under the lit-sphere shaders can be judged.
 *     The portraits are fixtures: they are `require`d ONLY from this module,
 *     which App.tsx loads ONLY inside `if (__DEV__)`. Metro constant-folds that
 *     branch away in a non-dev bundle before collecting dependencies, so this
 *     module and the JPEGs never enter a release/production bundle (verified by
 *     inspecting the Lab B release APK in WP-1.4, RUNBOOK-LAB-B.md §10). In dev
 *     the bytes come from the Metro asset server (the dev host), not the
 *     internet;
 *   - unlinked relationships on ~30 contacts (Orrery satellites);
 *   - custom Systems: "Lab B Dense" (~120 members), "Lab B Inner Circle" (12),
 *     "Lab B Work" (30).
 *
 * Idempotent: skipped when the "Lab B Dense" System already exists. No network,
 * no AI, no device Contacts. The procedural photo colours are fixture IMAGE
 * content (pixels in a JPEG), not UI colours, so they are computed numerically
 * rather than drawn from theme tokens.
 */
import { ImageFormat, Skia, TileMode } from "@shopify/react-native-skia";
import Constants from "expo-constants";
import { Directory, File, Paths } from "expo-file-system";
import { Image } from "react-native";
import { createContactFull, setContactPhoto } from "@/db/contacts-dao";
import { getExecutor, localDateTime } from "@/db/database";
import { recordTouchpoint } from "@/db/recency-dao";
import { addRelationship } from "@/db/relationships-dao";
import { saveSystemDefinition } from "@/db/systems-dao";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";
import { bumpShellRefresh } from "@/stores/shell-refresh-store";

// --- Tunables -----------------------------------------------------------------
export const LAB_B_PACKAGE = "com.bwales.orbit.labb";
const CONTACT_COUNT = 140;
const DENSE_SYSTEM_SIZE = 120;
const INNER_SYSTEM_SIZE = 12;
const WORK_SYSTEM_SIZE = 30;
const PHOTO_EVERY_NTH = 5; // 2 of every 5 get a photo (see hasPhoto)
const SATELLITE_PARENTS = 30;
const PHOTO_PX = 256;
const DENSE_NAME = "Lab B Dense";

// --- WP-1.4 test portraits (fictional fixtures, never shipped) -----------------
// Static requires so Metro can see them (dev bundle only, see header).
const PORTRAITS: readonly number[] = [
  require("../../docs/experiments/orrery-renderer/lab-b-skia-unleashed/assets/test-portraits/01-older-woman-black-mustard.jpg"),
  require("../../docs/experiments/orrery-renderer/lab-b-skia-unleashed/assets/test-portraits/02-young-man-east-asian-bright-cyan.jpg"),
  require("../../docs/experiments/orrery-renderer/lab-b-skia-unleashed/assets/test-portraits/03-teen-girl-south-asian-dark.jpg"),
  require("../../docs/experiments/orrery-renderer/lab-b-skia-unleashed/assets/test-portraits/04-older-man-white-busy-street.jpg"),
  require("../../docs/experiments/orrery-renderer/lab-b-skia-unleashed/assets/test-portraits/05-woman-latina-backlit-golden.jpg"),
  require("../../docs/experiments/orrery-renderer/lab-b-skia-unleashed/assets/test-portraits/06-man-black-glasses-office.jpg"),
  require("../../docs/experiments/orrery-renderer/lab-b-skia-unleashed/assets/test-portraits/07-child-red-hair-green.jpg"),
  require("../../docs/experiments/orrery-renderer/lab-b-skia-unleashed/assets/test-portraits/08-woman-middle-eastern-hijab-pastel.jpg"),
  require("../../docs/experiments/orrery-renderer/lab-b-skia-unleashed/assets/test-portraits/09-man-indigenous-long-hair-dusk.jpg"),
  require("../../docs/experiments/orrery-renderer/lab-b-skia-unleashed/assets/test-portraits/10-woman-blonde-flash-selfie.jpg"),
  require("../../docs/experiments/orrery-renderer/lab-b-skia-unleashed/assets/test-portraits/11-man-southeast-asian-profile.jpg"),
  require("../../docs/experiments/orrery-renderer/lab-b-skia-unleashed/assets/test-portraits/12-low-contrast-foggy.jpg"),
  require("../../docs/experiments/orrery-renderer/lab-b-skia-unleashed/assets/test-portraits/13-pet-dog.jpg"),
  require("../../docs/experiments/orrery-renderer/lab-b-skia-unleashed/assets/test-portraits/14-logo-graphic.jpg"),
  require("../../docs/experiments/orrery-renderer/lab-b-skia-unleashed/assets/test-portraits/15-landscape-mountains.jpg"),
  require("../../docs/experiments/orrery-renderer/lab-b-skia-unleashed/assets/test-portraits/16-man-curly-afro-neon.jpg"),
];
/**
 * contact index -> portrait index (0-based into PORTRAITS). Inner Circle =
 * indices 0, 11, 22, … (i % 11 === 0); Dense = 0..119; Work = 110..139. The
 * low-contrast (11), dog (12), logo (13) and landscape (14) fixtures sit in the
 * Inner Circle AND recur in Dense; every portrait is used about twice.
 */
const PORTRAIT_BY_CONTACT: ReadonlyMap<number, number> = new Map([
  // Inner Circle (7 of 12; the rest stay procedural / initials).
  [0, 0],
  [11, 11],
  [22, 12],
  [33, 4],
  [44, 13],
  [55, 9],
  [66, 15],
  // Dense (and the first round of the remaining portraits).
  [3, 1],
  [8, 2],
  [14, 3],
  [19, 5],
  [26, 6],
  [30, 7],
  [37, 8],
  [41, 10],
  [48, 14],
  [52, 11],
  [60, 12],
  // Second round, spread over Dense and Work.
  [70, 0],
  [75, 1],
  [83, 2],
  [90, 3],
  [95, 5],
  [104, 6],
  [113, 7],
  [118, 8],
  [125, 10],
  [131, 14],
  [137, 4],
  [100, 13],
]);

/**
 * Write a portrait fixture to the contact's normal `avatars/` file. The asset
 * URI is the Metro dev server (dev bundle only). Returns false on failure so
 * the caller can fall back to the procedural avatar.
 */
async function writePortrait(
  index: number,
  relative: string,
): Promise<boolean> {
  try {
    const source = Image.resolveAssetSource(PORTRAITS[index]);
    if (!source?.uri) return false;
    const file = new File(Paths.document, relative);
    if (file.exists) file.delete();
    await File.downloadFileAsync(source.uri, file);
    return file.exists;
  } catch (error) {
    console.warn("[lab-b-seed] portrait failed", index, error);
    return false;
  }
}

const FIRST = [
  "Ada",
  "Ben",
  "Cleo",
  "Dev",
  "Eli",
  "Fay",
  "Gus",
  "Hana",
  "Ivo",
  "Jun",
  "Kai",
  "Lena",
  "Milo",
  "Nia",
  "Omar",
  "Pia",
  "Quin",
  "Rosa",
  "Sami",
  "Tess",
  "Uma",
  "Vik",
  "Wren",
  "Xia",
  "Yuri",
  "Zoe",
  "Arlo",
  "Bea",
  "Cyd",
  "Dina",
];
const LAST = [
  "Abbott",
  "Brook",
  "Castillo",
  "Dorsey",
  "Ellis",
  "Ferreira",
  "Grant",
  "Holm",
  "Ibarra",
  "Jensen",
  "Kowal",
  "Laurent",
  "Moreau",
  "Novak",
  "Okafor",
];
const INTERVALS = [7, 14, 30, 30, 60, 90, 180, 365];
const RELATIONS = ["Partner", "Child", "Sibling", "Parent", "Friend", null];
const SAT_NAMES = ["Robin", "Sky", "Ash", "Juno", "Rey", "Max", "Lou", "Noor"];

/** Deterministic PRNG so every Lab B install gets the same fixture. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isLabB(): boolean {
  return Constants.expoConfig?.android?.package === LAB_B_PACKAGE;
}

function daysAgo(now: Date, days: number, hour: number): string {
  const d = new Date(now.getTime() - days * 86_400_000);
  d.setHours(hour, 0, 0, 0);
  return localDateTime(d);
}

/** HSV -> linear 0..1 RGB tuple (fixture pixel maths, not a UI colour). */
function hsv(h: number, s: number, v: number): Float32Array {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return Float32Array.of(f(5), f(3), f(1), 1);
}

/** Procedural portrait-ish avatar: gradient backdrop + head/shoulders silhouette. */
function renderAvatarJpeg(rand: () => number): Uint8Array | null {
  const surface = Skia.Surface.Make(PHOTO_PX, PHOTO_PX);
  if (!surface) return null;
  const canvas = surface.getCanvas();
  const hue = rand() * 360;
  const bg = Skia.Paint();
  bg.setShader(
    Skia.Shader.MakeLinearGradient(
      { x: 0, y: 0 },
      { x: PHOTO_PX, y: PHOTO_PX },
      [hsv(hue, 0.55, 0.95), hsv((hue + 70) % 360, 0.7, 0.45)],
      null,
      TileMode.Clamp,
    ),
  );
  canvas.drawRect(Skia.XYWHRect(0, 0, PHOTO_PX, PHOTO_PX), bg);
  const skin = Skia.Paint();
  skin.setColor(
    hsv(20 + rand() * 20, 0.25 + rand() * 0.45, 0.35 + rand() * 0.6),
  );
  canvas.drawCircle(PHOTO_PX / 2, PHOTO_PX * 0.42, PHOTO_PX * 0.2, skin);
  const shirt = Skia.Paint();
  shirt.setColor(hsv(rand() * 360, 0.6, 0.3 + rand() * 0.5));
  canvas.drawOval(
    Skia.XYWHRect(
      PHOTO_PX * 0.15,
      PHOTO_PX * 0.68,
      PHOTO_PX * 0.7,
      PHOTO_PX * 0.6,
    ),
    shirt,
  );
  const image = surface.makeImageSnapshot();
  return image.encodeToBytes(ImageFormat.JPEG, 85);
}

async function alreadySeeded(exec: SqlExecutor): Promise<boolean> {
  const row = await exec.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM systems WHERE name = ?",
    [DENSE_NAME],
  );
  return (row?.n ?? 0) > 0;
}

let running = false;

/**
 * Seed the Lab B fixture once. Safe to call on every launch: it is a no-op
 * outside a __DEV__ Lab B build or when the fixture already exists.
 */
export async function seedLabBFixtureIfAbsent(): Promise<void> {
  if (!__DEV__ || !isLabB() || running) return;
  running = true;
  try {
    const exec = getExecutor();
    if (await alreadySeeded(exec)) {
      console.log("[lab-b-seed] fixture already present");
      return;
    }
    const t0 = Date.now();
    const rand = rng(0x1ab_b);
    const nowDate = new Date();
    const now = localDateTime(nowDate);
    const ids: number[] = [];
    let photos = 0;
    let portraits = 0;
    let touchpoints = 0;
    for (let i = 0; i < CONTACT_COUNT; i += 1) {
      const name = `${FIRST[i % FIRST.length]} ${LAST[(i * 7 + Math.floor(i / FIRST.length)) % LAST.length]}`;
      const intervalDays = INTERVALS[Math.floor(rand() * INTERVALS.length)];
      // ~8% never contacted; otherwise a first touch 1..700 days ago.
      const never = rand() < 0.08;
      const firstAgo = 1 + Math.floor(rand() * 700);
      const { contactId } = await createContactFull(exec, {
        uid: newUid(),
        name,
        intervalDays,
        now,
        firstInteraction: never
          ? undefined
          : {
              uid: newUid(),
              occurredAt: daysAgo(nowDate, firstAgo, 12),
              channel: "Message",
              direction: "mutual",
              connected: 1,
            },
      });
      ids.push(contactId);
      // Skewed extra history: most get a few, some get many (deep gravity).
      if (!never) {
        const extra = Math.floor(rand() ** 2.2 * 24);
        for (let k = 0; k < extra; k += 1) {
          await recordTouchpoint(exec, {
            contactId,
            uid: newUid(),
            occurredAt: daysAgo(
              nowDate,
              1 + Math.floor(rand() * Math.min(firstAgo, 400)),
              9 + (k % 10),
            ),
            now,
            channel:
              k % 3 === 0 ? "Call" : k % 3 === 1 ? "Message" : "In Person",
            direction: k % 2 ? "outbound" : "inbound",
            connected: 1,
          });
          touchpoints += 1;
        }
      }
      const portrait = PORTRAIT_BY_CONTACT.get(i);
      const procedural = i % PHOTO_EVERY_NTH < 2;
      if (procedural || portrait !== undefined) {
        // Always consume the procedural draw for the original photo slots so the
        // PRNG sequence (and so every contact's cadence/history) is unchanged.
        const bytes = procedural ? renderAvatarJpeg(rand) : null;
        const relative = `avatars/contact-${contactId}.jpg`;
        new Directory(Paths.document, "avatars").create({
          intermediates: true,
          idempotent: true,
        });
        let wrote = false;
        if (portrait !== undefined) {
          wrote = await writePortrait(portrait, relative);
          if (wrote) portraits += 1;
        }
        if (!wrote && bytes) {
          const file = new File(Paths.document, relative);
          if (file.exists) file.delete();
          file.write(bytes);
          wrote = true;
        }
        if (wrote) {
          await setContactPhoto(exec, contactId, relative, now);
          photos += 1;
        }
      }
    }
    // Satellites: unlinked relationships on the first SATELLITE_PARENTS contacts
    // of the dense system so they show up there too.
    let sats = 0;
    for (let p = 0; p < SATELLITE_PARENTS; p += 1) {
      const contactId = ids[p * 3];
      const n = 1 + Math.floor(rand() * 4);
      for (let s = 0; s < n; s += 1) {
        await addRelationship(exec, {
          contactId,
          personName: SAT_NAMES[(p + s) % SAT_NAMES.length],
          relationType: RELATIONS[(p * 3 + s) % RELATIONS.length],
          createdAt: now,
          now,
        });
        sats += 1;
      }
    }
    const system = async (name: string, members: number[]) =>
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
    await system(DENSE_NAME, ids.slice(0, DENSE_SYSTEM_SIZE));
    await system(
      "Lab B Inner Circle",
      ids.filter((_, i) => i % 11 === 0).slice(0, INNER_SYSTEM_SIZE),
    );
    await system("Lab B Work", ids.slice(CONTACT_COUNT - WORK_SYSTEM_SIZE));
    bumpShellRefresh();
    console.log(
      `[lab-b-seed] seeded contacts=${ids.length} touchpoints=${touchpoints} photos=${photos} portraits=${portraits} satellites=${sats} in ${Date.now() - t0}ms`,
    );
  } catch (error) {
    console.error("[lab-b-seed] failed", error);
  } finally {
    running = false;
  }
}
