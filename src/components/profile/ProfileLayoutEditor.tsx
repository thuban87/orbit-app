// biome-ignore-all lint/a11y/useValidAriaRole: AppText role is a typography prop.
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  Alert,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  useWindowDimensions,
  View,
} from "react-native";
import { Icon } from "@/components/icons/Icon";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import { GlassSurface } from "@/components/ui/GlassSurface";
import { Sheet } from "@/components/ui/Sheet";
import { getExecutor, localDateTime } from "@/db/database";
import { setContactFreeformLayout } from "@/db/profile-presentation-dao";
import {
  createAllSectionsPreview,
  createProfileLayoutEditorDraft,
  type ProfileLayoutEditorAction,
  profileLayoutEditorReducer,
} from "@/profile/layout-editor-reducer";
import {
  createLayoutTemplateIntent,
  requestLayoutEditorDismissal,
  saveLayoutEditorDraft,
} from "@/profile/layout-editor-session";
import { PROFILE_MODULE_REGISTRY } from "@/profile/module-registry";
import { packOverviewModules } from "@/profile/pack-overview";
import type {
  ProfileLayoutDocument,
  ProfileModulePlacement,
} from "@/profile/types";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";

type EditorPage = "chooser" | "editor";

export interface ProfileLayoutEditorProps {
  visible: boolean;
  contactId: number;
  contactName: string;
  /** The resolved source label, e.g. Default or a Category/template name. */
  effectiveSource: string;
  layout: unknown;
  onRequestClose: () => void;
  /** Reload the screen's resolved presentation after the DAO's atomic save succeeds. */
  onCommitted?: (layout: ProfileLayoutDocument) => void;
  /** Plan 08 owns template creation; this component only hands it a draft intent. */
  onSaveAsTemplate?: (layout: ProfileLayoutDocument) => void;
}

function RowDragHandle({
  label,
  onMove,
}: {
  label: string;
  onMove: (direction: "up" | "down") => void;
}) {
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 8,
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy <= -20) onMove("up");
          if (gesture.dy >= 20) onMove("down");
        },
      }),
    [onMove],
  );

  return (
    <Pressable
      accessibilityRole="adjustable"
      accessibilityLabel={`Drag ${label} to reorder`}
      accessibilityHint="Swipe up or down to move this section one position."
      style={styles.dragHandle}
      {...panResponder.panHandlers}
    >
      <Icon name="sort" tone="textSecondary" size="md" />
    </Pressable>
  );
}

function EditorRow({
  placement,
  dispatch,
}: {
  placement: ProfileModulePlacement;
  dispatch: React.Dispatch<ProfileLayoutEditorAction>;
}) {
  const { colors } = useTheme();
  const definition = PROFILE_MODULE_REGISTRY[placement.id];
  const supportsSize = definition.supportedSizes.length > 1;
  const move = (direction: "up" | "down") =>
    dispatch({ type: "move", id: placement.id, direction });

  return (
    <GlassSurface density="dense" style={styles.editorRow}>
      <View style={styles.rowHeading}>
        <RowDragHandle label={definition.label} onMove={move} />
        <View style={styles.rowLabel}>
          <AppText role="label">{definition.label}</AppText>
          <AppText role="caption">
            {definition.parent === "profile"
              ? "Profile section"
              : "Child module"}
          </AppText>
        </View>
        <Switch
          value={placement.visible}
          onValueChange={(visible) =>
            dispatch({ type: "set-visible", id: placement.id, visible })
          }
          accessibilityLabel={`Show ${definition.label}`}
        />
      </View>
      <View style={styles.rowControls}>
        <Button
          role="tertiary"
          label="Move up"
          accessibilityLabel={`Move ${definition.label} up`}
          onPress={() => move("up")}
        />
        <Button
          role="tertiary"
          label="Move down"
          accessibilityLabel={`Move ${definition.label} down`}
          onPress={() => move("down")}
        />
        {definition.collapsible ? (
          <Button
            role="tertiary"
            label={
              placement.expanded
                ? "Expanded by default"
                : "Collapsed by default"
            }
            accessibilityLabel={`${placement.expanded ? "Collapse" : "Expand"} ${definition.label} by default`}
            onPress={() =>
              dispatch({
                type: "set-expanded",
                id: placement.id,
                expanded: !placement.expanded,
              })
            }
          />
        ) : null}
        {supportsSize ? (
          <Button
            role="tertiary"
            label={
              placement.size === "2x1" ? "Use compact size" : "Use wide size"
            }
            accessibilityLabel={`${placement.size === "2x1" ? "Use compact" : "Use wide"} size for ${definition.label}`}
            onPress={() =>
              dispatch({
                type: "set-size",
                id: placement.id,
                size: placement.size === "2x1" ? "1x1" : "2x1",
              })
            }
          />
        ) : null}
      </View>
      <AppText role="caption" style={{ color: colors.textSecondary }}>
        {placement.visible ? "Shown in this layout" : "Hidden in this layout"}
      </AppText>
    </GlassSurface>
  );
}

function Preview({ layout }: { layout: ProfileLayoutDocument }) {
  const { width, fontScale } = useWindowDimensions();
  const preview = createAllSectionsPreview(layout);
  const packed = packOverviewModules(
    preview.overview.map((placement) => ({
      id: placement.id,
      size: placement.size,
    })),
    { width: Math.max(1, width - SPACING.lg * 2), fontScale },
  );
  const topLevel = preview.topLevel.map(
    (placement) => PROFILE_MODULE_REGISTRY[placement.id].label,
  );

  return (
    <GlassSurface density="dense" style={styles.preview}>
      <AppText role="heading">Live preview</AppText>
      <AppText role="caption">Fixed Hero · {topLevel.join(" · ")}</AppText>
      <AppText role="caption">
        Overview auto-packs into {packed.columns} column
        {packed.columns === 1 ? "" : "s"} at this width.
      </AppText>
      <View style={styles.previewTiles}>
        {packed.placements.map((placement) => (
          <View
            key={placement.id}
            style={[
              styles.previewTile,
              {
                flexBasis: `${(placement.columnSpan / packed.columns) * 100}%`,
              },
            ]}
          >
            <AppText role="caption">
              {PROFILE_MODULE_REGISTRY[placement.id].label}
            </AppText>
          </View>
        ))}
      </View>
    </GlassSurface>
  );
}

export function ProfileLayoutEditor({
  visible,
  contactId,
  contactName,
  effectiveSource,
  layout,
  onRequestClose,
  onCommitted,
  onSaveAsTemplate,
}: ProfileLayoutEditorProps) {
  const [initial, setInitial] = useState(() =>
    createProfileLayoutEditorDraft(layout),
  );
  const [draft, dispatch] = useReducer(
    profileLayoutEditorReducer,
    layout,
    createProfileLayoutEditorDraft,
  );
  const [page, setPage] = useState<EditorPage>("chooser");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const wasVisible = useRef(false);
  useEffect(() => {
    if (!visible) {
      wasVisible.current = false;
      return;
    }
    if (wasVisible.current) return;
    const fresh = createProfileLayoutEditorDraft(layout);
    wasVisible.current = true;
    setInitial(fresh);
    dispatch({ type: "reset", layout: fresh });
    setPage("chooser");
    setSaveError(null);
  }, [layout, visible]);

  const closeOrGuard = () => {
    switch (requestLayoutEditorDismissal({ initial, draft, saving })) {
      case "close":
        onRequestClose();
        return;
      case "keep-editing":
        return;
      case "confirm-discard":
        Alert.alert(
          "Discard changes?",
          "Your layout changes have not been saved.",
          [
            { text: "Keep editing", style: "cancel" },
            {
              text: "Discard changes",
              style: "destructive",
              onPress: onRequestClose,
            },
          ],
        );
    }
  };

  const save = async () => {
    if (saving) return;
    if (requestLayoutEditorDismissal({ initial, draft, saving }) === "close") {
      onRequestClose();
      return;
    }
    setSaving(true);
    setSaveError(null);
    const result = await saveLayoutEditorDraft({
      draft,
      save: (nextLayout) =>
        setContactFreeformLayout(getExecutor(), {
          contactId,
          layout: nextLayout,
          now: localDateTime(),
        }),
    });
    if (result.ok) {
      onCommitted?.(draft);
      onRequestClose();
    } else {
      setSaveError(result.message);
    }
    setSaving(false);
  };

  return (
    <Sheet
      visible={visible}
      onRequestClose={closeOrGuard}
      variant={page === "editor" ? "expanded" : "detail"}
    >
      {page === "chooser" ? (
        <View style={styles.chooser}>
          <AppText role="heading">Profile Layout</AppText>
          <AppText role="body">
            {contactName} currently uses {effectiveSource}.
          </AppText>
          <AppText role="caption">
            Editing creates a contact-specific layout only after you save.
          </AppText>
          <Button
            role="primary"
            label="Edit layout"
            onPress={() => setPage("editor")}
          />
          <Button role="secondary" label="Close" onPress={closeOrGuard} />
        </View>
      ) : (
        <View style={styles.editor} accessibilityViewIsModal>
          <ScrollView contentContainerStyle={styles.editorContent}>
            <AppText role="heading">Edit layout</AppText>
            <AppText role="body">
              Drag a handle or use Move up and Move down. Every section stays in
              its parent.
            </AppText>
            <Preview layout={draft} />
            <AppText role="label">Profile sections</AppText>
            {draft.topLevel.map((placement) => (
              <EditorRow
                key={placement.id}
                placement={placement}
                dispatch={dispatch}
              />
            ))}
            <AppText role="label">Relationship Overview</AppText>
            {draft.overview.map((placement) => (
              <EditorRow
                key={placement.id}
                placement={placement}
                dispatch={dispatch}
              />
            ))}
            <AppText role="label">Things to Remember</AppText>
            {draft.thingsToRemember.map((placement) => (
              <EditorRow
                key={placement.id}
                placement={placement}
                dispatch={dispatch}
              />
            ))}
          </ScrollView>
          {saveError ? <AppText role="caption">{saveError}</AppText> : null}
          <View style={styles.footer}>
            <Button
              role="secondary"
              label="Cancel layout changes"
              onPress={closeOrGuard}
            />
            {onSaveAsTemplate ? (
              <Button
                role="tertiary"
                label="Save as template"
                onPress={() =>
                  onSaveAsTemplate(createLayoutTemplateIntent(draft))
                }
              />
            ) : null}
            <Button
              role="primary"
              label={saving ? "Saving…" : "Save layout"}
              disabled={saving}
              onPress={() => void save()}
            />
          </View>
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  chooser: { gap: SPACING.base },
  editor: { flex: 1, gap: SPACING.sm },
  editorContent: { gap: SPACING.sm, paddingBottom: SPACING.base },
  editorRow: { gap: SPACING.sm, padding: SPACING.sm },
  rowHeading: { alignItems: "center", flexDirection: "row", gap: SPACING.sm },
  rowLabel: { flex: 1, gap: SPACING.xs },
  rowControls: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs },
  dragHandle: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    minWidth: 44,
    borderRadius: RADII.full,
  },
  preview: { gap: SPACING.sm, padding: SPACING.base },
  previewTiles: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs },
  previewTile: { minHeight: 44, justifyContent: "center", padding: SPACING.xs },
  footer: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
});
