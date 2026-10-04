/**
 * H3 rule 1 (38.7-07 `<resource_lifetime_contract>`): one picture layer's
 * acknowledgement, shared by the Orrery canvas (OrreryV2Canvas) and, since
 * 38.7-14 (C-H2), the System Preview canvas with its own layer ids and its
 * own ledger epoch.
 */
import type { SkPicture } from "@shopify/react-native-skia";
import {
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
  useSharedValue,
} from "react-native-reanimated";

/** What a layer's ack reaction compares: its picture and the generation it read. */
interface LayerRecord {
  picture: SkPicture;
  generation: number;
  epoch: number;
}

/**
 * The reaction is chained on the layer's picture value, so it runs only after
 * `createPicture` returned; a new (generation, epoch) arms ONE frame callback
 * (never a running loop), and that callback forwards the latest recorded
 * generation to JS.
 *
 * `requireNewRecording` (default true): only a NEW picture speaks for a
 * generation. The base layer passes false: its picture value SELECTS the live
 * picture or a snapshot by reading its spec (it records nothing itself), so
 * every run that read generation g shows exactly what g says, even when the
 * selected picture object is unchanged.
 */
export function useLayerAck<
  L extends string,
  S extends { generation: number; mountEpoch: number },
>(
  layerId: L,
  picture: SharedValue<SkPicture>,
  specs: SharedValue<S>,
  ackRecorded: (layerId: L, generation: number, epoch: number) => void,
  requireNewRecording = true,
): void {
  const pending = useSharedValue(false);
  const latest = useSharedValue({ generation: 0, epoch: 0 });
  useAnimatedReaction(
    (): LayerRecord => ({
      picture: picture.value,
      generation: specs.value.generation,
      epoch: specs.value.mountEpoch,
    }),
    (now, previous) => {
      // Only a NEW recording speaks for a generation.
      if (requireNewRecording && previous && now.picture === previous.picture)
        return;
      if (now.generation === 0) return;
      if (
        previous &&
        previous.generation === now.generation &&
        previous.epoch === now.epoch
      )
        return;
      latest.value = { generation: now.generation, epoch: now.epoch };
      if (pending.value) return;
      pending.value = true;
      requestAnimationFrame(() => {
        pending.value = false;
        const recorded = latest.value;
        runOnJS(ackRecorded)(layerId, recorded.generation, recorded.epoch);
      });
    },
  );
}
