/**
 * widget-render — the headless RemoteViews render tree (WDG-01).
 *
 * =============================================================================
 * WHAT THIS IS: `renderFavourites(widgetInfo?)` builds the `FlexWidget` /
 * `ImageWidget` / `TextWidget` tree that `react-native-android-widget` rasterises
 * off-screen to ONE PNG (the widget bitmap). It is the visual surface of the
 * favourites widget; the 12-06 task handler feeds its result to
 * `requestWidgetUpdate`. The actual on-device render + the small↔large breakpoint
 * are device-UAT (12-08) — node/tsc can only prove the tree TYPE-checks, resolves
 * every colour from the palette, and wires the correct click actions.
 *
 * SIZE-DRIVEN LAYOUT (Codex HIGH): `renderFavourites` TAKES the library's
 * `widgetInfo` (the resize handler in 12-06 passes `props.widgetInfo`) and selects
 * the SMALL (mark-grid) vs LARGE (avatar + fuel + Mark/Log/Message) tree via the
 * pure `pickLayout`. Without the size argument one layout would be dead code or
 * every size would render identically. A plain `WIDGET_UPDATE` with no size info
 * defaults to SMALL.
 *
 * NO THEME PROVIDER (RESEARCH Pattern 4 / T-12-05): this runs HEADLESS with no
 * `ThemeProvider` mounted, so the React theme hook is unavailable. Every colour resolves
 * from `widgetPalette()` (widget-colors, 12-03) — the dark-first space-dark
 * palette read straight from theme-presets. There is NO hex literal here and NO
 * React theme hook (check:colors / CLAUDE.md). The widget lib's colour props are
 * typed as template-literal `ColorProp`; the palette values ARE the sanctioned
 * theme-presets colour strings, so they are cast through `asColor` at the seam.
 *
 * PER-TILE FAULT ISOLATION (Codex/Claude M2): each tile's `encodeWidgetThumb` is
 * wrapped in its own try/catch (belt-and-suspenders with 12-03, which already
 * returns null on decode failure), so a single corrupt/evicted master downgrades
 * THAT tile to its initials swatch and NEVER rejects the whole render / blanks the
 * grid. The image source is ALWAYS the base64 `data:` URI (T-12-05) — never a
 * `file://` or network path.
 *
 * BEST-EFFORT, POST-MARK (codex MED): the widget-tap mark is COMMITTED by the
 * 12-06 handler BEFORE this render runs, and the render is invoked through a
 * swallowing wrapper — so a slow/failed render can never roll back or throw past
 * the already-committed mark. The mark is the durable action; the bitmap is a
 * glance aid.
 *
 * NO SWEEP IMPORT (T-12-07): this module imports NOTHING that reaches the
 * launch-sweep runner — a headless render must never trigger quarantine/purge.
 * =============================================================================
 */
import type React from "react";
import {
  type ColorProp,
  FlexWidget,
  ImageWidget,
  type ImageWidgetSource,
  TextWidget,
  type WidgetInfo,
} from "react-native-android-widget";
import { getExecutor, openAndMigrate } from "@/db/database";
import { Logger } from "@/utils/logger";
import {
  ringColor,
  ringWeight,
  type WidgetPalette,
  widgetPalette,
} from "./widget-colors";
import { loadWidgetTiles, type WidgetTile } from "./widget-data";
import { encodeWidgetThumb } from "./widget-photo";

const LOG_SCOPE = "widget-render";

// --- Tunable constants (top-of-file per project convention) ------------------

/**
 * The dp width at/above which a resized widget renders the LARGE (fuel + actions)
 * tree; below it, the SMALL mark-grid. Device-spike-tunable (12-08 measures the
 * real Pixel breakpoint). Single-number edit.
 */
const LARGE_MIN_WIDTH_DP = 300;

/** Favourites shown in the SMALL grid before rank-truncation (device-tunable, 12-08). */
const SMALL_CAPACITY = 6;
/** Favourites shown in the LARGE list of action rows (fewer — each row is taller). */
const LARGE_CAPACITY = 4;
/** Small-grid columns per row (visual geometry is device-UAT in 12-08). */
const SMALL_COLUMNS = 3;

/** Avatar diameter in dp; `radius = AVATAR_PX / 2` makes the "planet" circular. */
const AVATAR_PX = 48;
/** Android touch-target floor — every tap rectangle is >= this (UI-SPEC). */
const TAP_MIN_DP = 48;

// Spacing scale (UI-SPEC, all multiples of 4).
const SPACING_XS = 4;
const SPACING_SM = 8;
const SPACING_MD = 12;
const SPACING_XL = 24;

// Typography (sp) — UI-SPEC typography table.
const NAME_SP = 13;
const FUEL_SP = 11;
const BTN_LABEL_SP = 11;
const GLYPH_SP = 16;
const INITIALS_SP = 18;
const EMPTY_HEAD_SP = 15;
const EMPTY_BODY_SP = 12;
const CHEVRON_SP = 15;

/**
 * Cast a resolved palette colour string to the widget lib's template-literal
 * `ColorProp`. The palette sources every value from theme-presets (the ONE
 * sanctioned colour-literal file), so this seam holds no colour literal of its
 * own — it only re-types the already-resolved token for the lib.
 */
const asColor = (value: string): ColorProp => value as ColorProp;

/** Re-type a base64 `data:` URI as the lib's image source (never file:///http). */
const asImageSource = (dataUri: string): ImageWidgetSource =>
  dataUri as ImageWidgetSource;

/** One tile plus its resolved base64 thumb (null → initials-swatch fallback). */
interface RenderTile {
  tile: WidgetTile;
  thumb: string | null;
}

/**
 * PURE size switch: read `widgetInfo.width` (dp) against the tunable breakpoint
 * and return the size bucket + its grid capacity. Defaults to SMALL when
 * `widgetInfo` is undefined — a plain WIDGET_UPDATE carries no size (Codex HIGH).
 */
export function pickLayout(widgetInfo?: WidgetInfo): {
  bucket: "small" | "large";
  capacity: number;
} {
  if (widgetInfo && widgetInfo.width >= LARGE_MIN_WIDTH_DP) {
    return { bucket: "large", capacity: LARGE_CAPACITY };
  }
  return { bucket: "small", capacity: SMALL_CAPACITY };
}

/**
 * Build the favourites widget tree for the given size. Opens the DB defensively
 * (the render may run headless), resolves the palette, picks the layout from the
 * size, loads + encodes the tiles (each encode fault-isolated), and returns the
 * SMALL grid, the LARGE action list, or the empty "Choose favourites" prompt.
 */
export async function renderFavourites(
  widgetInfo?: WidgetInfo,
): Promise<React.JSX.Element> {
  // The render can run in a headless context where App.tsx never mounted, so
  // bootstrap the DB before getExecutor() (idempotent when already open).
  await openAndMigrate();
  const exec = getExecutor();

  const palette = widgetPalette();
  const { bucket, capacity } = pickLayout(widgetInfo);

  const tiles = await loadWidgetTiles(exec, {
    capacity,
    swatchCount: palette.avatarSwatches.length,
  });

  if (tiles.length === 0) {
    return <EmptyTile palette={palette} />;
  }

  // Per-tile fault isolation: one corrupt/evicted master must degrade THAT tile
  // to its initials swatch, never reject the whole render (M2). encodeWidgetThumb
  // already returns null on failure; the try/catch is a belt-and-suspenders.
  const rendered: RenderTile[] = await Promise.all(
    tiles.map(async (tile) => {
      let thumb: string | null = null;
      try {
        thumb = await encodeWidgetThumb(tile.relativePhoto);
      } catch (error) {
        Logger.error(
          LOG_SCOPE,
          `tile ${tile.id} thumb encode threw; falling back to initials`,
          error,
        );
        thumb = null;
      }
      return { tile, thumb };
    }),
  );

  return bucket === "large" ? (
    <LargeGrid rendered={rendered} palette={palette} />
  ) : (
    <SmallGrid rendered={rendered} palette={palette} />
  );
}

/**
 * The circular avatar "planet": the base64 photo thumb when it encoded, else the
 * deterministic themed swatch + centred initials (the SAME scheme as the in-app
 * Avatar). Both silhouettes are identical so the status ring reads the same.
 */
function Avatar({
  tile,
  thumb,
  palette,
}: {
  tile: WidgetTile;
  thumb: string | null;
  palette: WidgetPalette;
}): React.JSX.Element {
  if (thumb) {
    return (
      <ImageWidget
        image={asImageSource(thumb)}
        imageWidth={AVATAR_PX}
        imageHeight={AVATAR_PX}
        radius={AVATAR_PX / 2}
      />
    );
  }
  return (
    <FlexWidget
      style={{
        height: AVATAR_PX,
        width: AVATAR_PX,
        borderRadius: AVATAR_PX / 2,
        backgroundColor: asColor(palette.avatarSwatches[tile.swatchIndex]),
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <TextWidget
        text={tile.initials}
        maxLines={1}
        style={{
          color: asColor(palette.avatarSwatchText),
          fontSize: INITIALS_SP,
          fontWeight: "600",
          textAlign: "center",
        }}
      />
    </FlexWidget>
  );
}

/**
 * SMALL tile: the whole tile is the no-undo mark region (biggest hit-area,
 * WIDGET_MARK); the ring border (colour + escalating weight) wraps it; the
 * name+chevron pill on a faint surfaceElevated fill is the distinct >=48dp
 * profile target (OPEN_URI → orbit://contact/{id}).
 */
function SmallTile({
  tile,
  thumb,
  palette,
}: {
  tile: WidgetTile;
  thumb: string | null;
  palette: WidgetPalette;
}): React.JSX.Element {
  return (
    <FlexWidget
      clickAction="WIDGET_MARK"
      clickActionData={{ contactId: tile.id }}
      style={{
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: SPACING_SM,
        margin: SPACING_XS,
        borderWidth: ringWeight(tile.status),
        borderColor: asColor(ringColor(tile.status, palette)),
        borderRadius: SPACING_MD,
      }}
    >
      <Avatar tile={tile} thumb={thumb} palette={palette} />
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: `orbit://contact/${tile.id}` }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          height: TAP_MIN_DP,
          marginTop: SPACING_XS,
          paddingHorizontal: SPACING_SM,
          backgroundColor: asColor(palette.surfaceElevated),
          borderRadius: TAP_MIN_DP / 2,
        }}
      >
        <TextWidget
          text={tile.name}
          maxLines={1}
          truncate="END"
          style={{
            color: asColor(palette.textPrimary),
            fontSize: NAME_SP,
            fontWeight: "600",
          }}
        />
        <TextWidget
          text="›"
          maxLines={1}
          style={{
            color: asColor(palette.accent),
            fontSize: CHEVRON_SP,
            marginLeft: SPACING_XS,
          }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}

/** One >=48dp action button: glyph over label, surfaceElevated fill. */
function ActionButton({
  glyph,
  label,
  glyphColor,
  palette,
  clickAction,
  clickActionData,
}: {
  glyph: string;
  label: string;
  glyphColor: string;
  palette: WidgetPalette;
  clickAction: string;
  clickActionData: Record<string, unknown>;
}): React.JSX.Element {
  return (
    <FlexWidget
      clickAction={clickAction}
      clickActionData={clickActionData}
      style={{
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: TAP_MIN_DP,
        width: TAP_MIN_DP,
        marginLeft: SPACING_XS,
        padding: SPACING_XS,
        backgroundColor: asColor(palette.surfaceElevated),
        borderRadius: SPACING_SM,
      }}
    >
      <TextWidget
        text={glyph}
        maxLines={1}
        style={{ color: asColor(glyphColor), fontSize: GLYPH_SP }}
      />
      <TextWidget
        text={label}
        maxLines={1}
        style={{
          color: asColor(palette.textPrimary),
          fontSize: BTN_LABEL_SP,
          fontWeight: "600",
        }}
      />
    </FlexWidget>
  );
}

/**
 * LARGE tile row: avatar + ring on the left, a middle column of name over the
 * ranked fuel line, then the three action buttons — Mark (WIDGET_MARK), Log
 * (OPEN_URI → orbit://contact/{id}, the owner-ratified Profile target, 12-04
 * Task-1), Message (OPEN_URI → orbit://compose/{id}). The text label is the
 * source of truth; the glyph is decorative (UI-SPEC copy contract).
 */
function LargeTile({
  tile,
  thumb,
  palette,
}: {
  tile: WidgetTile;
  thumb: string | null;
  palette: WidgetPalette;
}): React.JSX.Element {
  return (
    <FlexWidget
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        width: "match_parent",
        paddingHorizontal: SPACING_MD,
        paddingVertical: SPACING_SM,
        marginBottom: SPACING_SM,
        backgroundColor: asColor(palette.surface),
        borderRadius: SPACING_MD,
      }}
    >
      <FlexWidget
        style={{
          height: AVATAR_PX + ringWeight(tile.status) * 2,
          width: AVATAR_PX + ringWeight(tile.status) * 2,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: ringWeight(tile.status),
          borderColor: asColor(ringColor(tile.status, palette)),
          borderRadius: (AVATAR_PX + ringWeight(tile.status) * 2) / 2,
        }}
      >
        <Avatar tile={tile} thumb={thumb} palette={palette} />
      </FlexWidget>

      <FlexWidget
        style={{
          flex: 1,
          flexDirection: "column",
          justifyContent: "center",
          paddingHorizontal: SPACING_MD,
        }}
      >
        <TextWidget
          text={tile.name}
          maxLines={1}
          truncate="END"
          style={{
            color: asColor(palette.textPrimary),
            fontSize: NAME_SP,
            fontWeight: "600",
          }}
        />
        <TextWidget
          text={tile.fuelText ?? ""}
          maxLines={1}
          truncate="END"
          style={{ color: asColor(palette.textSecondary), fontSize: FUEL_SP }}
        />
      </FlexWidget>

      <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
        <ActionButton
          glyph="✓"
          label="Mark"
          glyphColor={palette.textSecondary}
          palette={palette}
          clickAction="WIDGET_MARK"
          clickActionData={{ contactId: tile.id }}
        />
        <ActionButton
          glyph="✎"
          label="Log"
          glyphColor={palette.textSecondary}
          palette={palette}
          clickAction="OPEN_URI"
          clickActionData={{ uri: `orbit://contact/${tile.id}` }}
        />
        <ActionButton
          glyph="✉"
          label="Message"
          glyphColor={palette.accent}
          palette={palette}
          clickAction="OPEN_URI"
          clickActionData={{ uri: `orbit://compose/${tile.id}` }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}

/** The SMALL mark-grid: rows of up to SMALL_COLUMNS tiles on the widget field. */
function SmallGrid({
  rendered,
  palette,
}: {
  rendered: RenderTile[];
  palette: WidgetPalette;
}): React.JSX.Element {
  const rows: RenderTile[][] = [];
  for (let i = 0; i < rendered.length; i += SMALL_COLUMNS) {
    rows.push(rendered.slice(i, i + SMALL_COLUMNS));
  }
  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: SPACING_MD,
        backgroundColor: asColor(palette.background),
      }}
    >
      {rows.map((row, rowIndex) => (
        <FlexWidget
          // biome-ignore lint/suspicious/noArrayIndexKey: static rank order; rows never reorder
          key={rowIndex}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {row.map(({ tile, thumb }) => (
            <SmallTile
              key={tile.id}
              tile={tile}
              thumb={thumb}
              palette={palette}
            />
          ))}
        </FlexWidget>
      ))}
    </FlexWidget>
  );
}

/** The LARGE list: one full-width avatar + fuel + actions row per favourite. */
function LargeGrid({
  rendered,
  palette,
}: {
  rendered: RenderTile[];
  palette: WidgetPalette;
}): React.JSX.Element {
  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        flexDirection: "column",
        justifyContent: "flex-start",
        padding: SPACING_MD,
        backgroundColor: asColor(palette.background),
      }}
    >
      {rendered.map(({ tile, thumb }) => (
        <LargeTile key={tile.id} tile={tile} thumb={thumb} palette={palette} />
      ))}
    </FlexWidget>
  );
}

/**
 * The EMPTY-state tile: no favourites yet → a centred "Choose favourites" prompt
 * (outline star in accent), the whole tile deep-linking to Manage favourites so
 * an empty widget becomes onboarding for the feature it depends on. Exact copy
 * from the UI-SPEC copywriting contract.
 */
function EmptyTile({ palette }: { palette: WidgetPalette }): React.JSX.Element {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: "orbit://favourites" }}
      style={{
        height: "match_parent",
        width: "match_parent",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: SPACING_XL,
        backgroundColor: asColor(palette.background),
      }}
    >
      <TextWidget
        text="☆"
        maxLines={1}
        style={{
          color: asColor(palette.accent),
          fontSize: EMPTY_HEAD_SP + SPACING_SM,
          marginBottom: SPACING_SM,
        }}
      />
      <TextWidget
        text="Choose favourites"
        maxLines={1}
        style={{
          color: asColor(palette.textPrimary),
          fontSize: EMPTY_HEAD_SP,
          fontWeight: "600",
          textAlign: "center",
        }}
      />
      <TextWidget
        text="Pick who you want to keep close — they'll show up here."
        maxLines={3}
        style={{
          color: asColor(palette.textSecondary),
          fontSize: EMPTY_BODY_SP,
          textAlign: "center",
          marginTop: SPACING_XS,
        }}
      />
    </FlexWidget>
  );
}
