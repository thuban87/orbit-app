/**
 * 38.7-14 (D-57, C-H2): the System Preview's native-object owner (JS thread,
 * no React, no Skia calls of its own). It follows Plan 07's canonical
 * `<resource_lifetime_contract>` (38.7-07-PLAN.md) exactly as the Orrery
 * world does, with the Preview's OWN generation ledger (so its own mount
 * epochs) and its OWN layer ids (`PREVIEW_LAYER`):
 *
 *   - the body specs (looks + initials Paragraphs + photo SkImages) are
 *     published to `preview-bodies`, the baked nebula image to `preview-sky`;
 *   - each layer acks `(layerId, generation, mountEpoch)` after its picture
 *     recorded (`ack`); an object is handed back to its holder only once every
 *     Preview layer that recorded it acked a newer generation in this epoch;
 *   - `release` (unmount: blur or background) ends the epoch at once and
 *     returns `finish`, which the caller runs after one UI round trip (the
 *     pictures detached, no mapper can still record): every retained object
 *     goes back in reverse creation order, the photo and text pins of the
 *     "system-preview" owner are confirmed released and unheld entries are
 *     cleared;
 *   - late acks, decodes and shapes tagged with an ended epoch are discarded
 *     and disposed by the holders (ledger rule 4).
 *
 * The photo cache and the text service are the shared, owner-aware ones: the
 * Preview's owner id is its own (`system-preview:<n>`), so releasing it never
 * disposes an image or Paragraph another owner (the Orrery world) pins.
 */
import {
  createOrreryGenerationLedger,
  type OrreryGenerationLedger,
} from "./resources/orrery-generation-ledger";
import {
  type OrreryPhotoCache,
  orreryPhotoCache,
} from "./resources/orrery-photo-cache";
import {
  createOrreryTextPublisher,
  type OrreryTextScene,
  type OrreryTextService,
  type OrreryTextVisibility,
  orreryTextService,
} from "./resources/orrery-text-service";
import { PREVIEW_LAYER } from "./system-preview-logic";
import {
  createSkyBakeOwner,
  type SkyBakeInput,
  type SkyBakeOwnerOptions,
} from "./v2/nebula-bake";
import {
  buildPhotoRequests,
  createOrrerySpecPublisher,
  type OrreryBodyLook,
  type OrreryBodySpecs,
  parseLedgerHandle,
  type SkyImageSpec,
} from "./v2/scene-specs";

export interface PreviewResourcesOptions {
  /** Owner id for the shared caches (default `system-preview:<n>`). */
  owner?: string;
  photoCache?: OrreryPhotoCache;
  textService?: OrreryTextService;
  /** A ledger for tests; each controller otherwise makes its own. */
  ledger?: OrreryGenerationLedger<string>;
  /** Writes the body specs SharedValue (never React state). */
  writeBodies: (specs: OrreryBodySpecs) => void;
  /** Writes the sky image SharedValue (never React state). */
  writeSky: (spec: SkyImageSpec) => void;
  /** Sky bake seams (tests). */
  bake?: SkyBakeOwnerOptions["bake"];
  schedule?: SkyBakeOwnerOptions["schedule"];
  log?: SkyBakeOwnerOptions["log"];
}

export interface PreviewResources {
  readonly owner: string;
  /** Resources or theme changed: the body looks (and so the wanted photos). */
  setLooks(looks: readonly OrreryBodyLook[]): void;
  /** The initials to shape (labels are not drawn in the Preview). */
  setText(scene: OrreryTextScene, visibility: OrreryTextVisibility): void;
  /** Mount, theme or size-bucket change: the neutral nebula bake. */
  requestSky(input: SkyBakeInput): void;
  /** A Preview layer recorded `generation` of `epoch` one UI frame ago. */
  ack(layerId: string, generation: number, epoch: number): void;
  /**
   * Unmount: ends the epoch now and returns the step to run after one UI
   * round trip (contract rule 3). Idempotent; later calls return a no-op.
   */
  release(): () => void;
  /** The ledger's current epoch (null once released). */
  epoch(): number | null;
}

let previewSerial = 0;

export function createPreviewResources(
  options: PreviewResourcesOptions,
): PreviewResources {
  const owner = options.owner ?? `system-preview:${++previewSerial}`;
  const photos = options.photoCache ?? orreryPhotoCache;
  const textService = options.textService ?? orreryTextService;
  const ledger = options.ledger ?? createOrreryGenerationLedger<string>();
  const specs = createOrrerySpecPublisher({
    ledger,
    writeBodies: options.writeBodies,
    bodyLayers: [PREVIEW_LAYER.bodies],
  });
  const text = createOrreryTextPublisher({
    service: textService,
    owner,
    write: (_labels, initials) => {
      if (initials) specs.setInitials(initials);
    },
  });
  const sky = createSkyBakeOwner({
    ledger,
    layerId: PREVIEW_LAYER.sky,
    ensureEpoch: () => specs.ensureEpoch(),
    write: options.writeSky,
    ...(options.bake ? { bake: options.bake } : {}),
    ...(options.schedule ? { schedule: options.schedule } : {}),
    ...(options.log !== undefined ? { log: options.log } : {}),
  });
  let photoEpoch: number | null = null;
  let released = false;

  /**
   * Hands ledger-released objects back to their holders, batched per holder
   * and epoch (one confirmation frees the whole set): photos to the shared
   * cache, Paragraphs to the text publisher, nebula images to the sky owner.
   */
  function route(handles: Iterable<string>, dispose: boolean): void {
    const photoIds = new Map<number, number[]>();
    const textKeys = new Map<number, string[]>();
    const skyIds: number[] = [];
    for (const handle of handles) {
      const parsed = parseLedgerHandle(handle);
      if (parsed?.kind === "photo")
        photoIds.set(parsed.epoch, [
          ...(photoIds.get(parsed.epoch) ?? []),
          parsed.id,
        ]);
      else if (parsed?.kind === "text")
        textKeys.set(parsed.epoch, [
          ...(textKeys.get(parsed.epoch) ?? []),
          parsed.key,
        ]);
      else if (parsed?.kind === "sky") skyIds.push(parsed.id);
    }
    for (const [epoch, ids] of photoIds)
      photos.confirmRetired(owner, ids, epoch, { dispose });
    for (const [epoch, keys] of textKeys)
      text.confirmRetired(keys, epoch, dispose);
    if (skyIds.length > 0) sky.retire(skyIds);
  }

  return {
    owner,
    setLooks(looks) {
      if (released) return;
      specs.setLooks(looks);
      if (photoEpoch === null)
        photoEpoch = photos.mount(owner, () => {
          const epoch = photoEpoch;
          if (epoch !== null && !released)
            specs.setPhotos(photos.drawn(owner), epoch);
        });
      photos.request(owner, buildPhotoRequests(looks, new Set(), null));
    },
    setText(scene, visibility) {
      if (released) return;
      text.setScene(scene);
      text.setVisibility(visibility);
    },
    requestSky(input) {
      if (released) return;
      sky.request(input);
    },
    ack(layerId, generation, epoch) {
      if (!ledger.ack(layerId, generation, epoch)) return;
      route(ledger.retirable(), false);
    },
    release() {
      if (released) return () => {};
      released = true;
      // Pins retire now and the publishing epochs end; nothing new publishes.
      const textEpoch = text.release();
      sky.detach();
      const ledgerEpoch = specs.detach();
      const photoMount = photoEpoch;
      photoEpoch = null;
      if (photoMount !== null) photos.release(owner);
      let finished = false;
      return () => {
        if (finished) return;
        finished = true;
        if (ledgerEpoch !== null)
          ledger.teardown((handle) => route([handle], true), ledgerEpoch);
        if (photoMount !== null) photos.confirmReleased(owner, photoMount);
        photos.clearUnheld();
        if (textEpoch !== null) textService.confirmReleased(owner, textEpoch);
        textService.clearUnheld();
      };
    },
    epoch: () => (released ? null : ledger.epoch()),
  };
}
