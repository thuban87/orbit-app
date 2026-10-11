// biome-ignore-all lint/a11y/useValidAriaRole: `role` is Orbit's visual/typography domain prop.
import * as DocumentPicker from "expo-document-picker";
import { Directory, File, Paths } from "expo-file-system";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from "react-native";
import {
  COST_ESTIMATE_UNAVAILABLE,
  estimatePromptContext,
  type PromptContextEstimate,
} from "@/ai/context-estimate";
import { loadCachedCatalog } from "@/ai/model-catalog-cache";
import { createFileCatalogStorage } from "@/ai/model-catalog-storage";
import { resolveActiveCatalog } from "@/ai/model-registry";
import {
  loadCachedOpenRouterCatalog,
  type OpenRouterCatalogStorage,
  type OpenRouterModel,
} from "@/ai/openrouter-catalog";
import { Icon } from "@/components/icons/Icon";
import { SegmentedControl } from "@/components/SegmentedControl";
import { ShellAppBar } from "@/components/ShellAppBar";
import {
  AppText,
  Button,
  ConfirmDialog,
  GlassSurface,
  MIN_TOUCH_TARGET,
} from "@/components/ui";
import { ScopedPalette } from "@/components/ui/ScopedPalette";
import { resolveActiveAiConnection } from "@/db/ai-connections-dao";
import { getExecutor, localDateTime } from "@/db/database";
import {
  createPersonalizationSection,
  deletePersonalizationSection,
  getWritingStyle,
  importPersonalizationSection,
  listPersonalizationSections,
  type PersonalizationSection,
  reorderPersonalizationSections,
  replacePersonalizationSectionFromImport,
  setPersonalizationSectionEnabled,
  updatePersonalizationSection,
  updateWritingStyle,
  type WritingDirectness,
  type WritingLength,
  type WritingStyle,
  type WritingTone,
} from "@/db/personalization-dao";
import { useDiscardKeepGuard } from "@/navigation/discard-keep-guard";
import { useBottomClearance } from "@/navigation/use-bottom-clearance";
import type { AiCloudProviderId } from "@/services/ai-types";
import { showSnackbar } from "@/stores/snackbar-store";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { Logger } from "@/utils/logger";
import {
  applyStyleLoad,
  applyStyleSave,
  createEstimateDebouncer,
  formatEstimateCaption,
  hasSectionDraftChanges,
  initialStyleSync,
  isWritingStyleDirty,
  moveSectionUid,
  personalizationEstimateSource,
  type StyleSyncState,
} from "./ai-personalization-logic";

const LOG_SCOPE = "ai-personalization";
const EMPTY_COPY =
  "Add a section or paste text to tell Orbit how you write and what matters to you.";

const DEFAULT_STYLE: WritingStyle = {
  tone: "balanced",
  length: "normal",
  directness: "balanced",
  freeform: "",
};

const TONE_OPTIONS = [
  { label: "Casual", value: "casual" },
  { label: "Balanced", value: "balanced" },
  { label: "Polished", value: "polished" },
] satisfies Array<{ label: string; value: Exclude<WritingTone, "custom"> }>;

const LENGTH_OPTIONS = [
  { label: "Concise", value: "concise" },
  { label: "Normal", value: "normal" },
  { label: "Detailed", value: "detailed" },
] satisfies Array<{ label: string; value: Exclude<WritingLength, "custom"> }>;

const DIRECTNESS_OPTIONS = [
  { label: "Gentle", value: "gentle" },
  { label: "Balanced", value: "balanced" },
  { label: "Direct", value: "direct" },
] satisfies Array<{
  label: string;
  value: Exclude<WritingDirectness, "custom">;
}>;

interface ActiveEstimateModel {
  lane: AiCloudProviderId;
  model: string;
  openRouterModel: OpenRouterModel | null;
  contextWindowTokens: number | null;
}

function createOpenRouterStorage(): OpenRouterCatalogStorage {
  const file = () =>
    new File(Paths.document, "ai", "openrouter-model-catalog.json");
  return {
    async read() {
      const target = file();
      return target.exists ? target.text() : null;
    },
    async write(value) {
      new Directory(Paths.document, "ai").create({
        intermediates: true,
        idempotent: true,
      });
      const target = file();
      if (!target.exists) target.create({ intermediates: true });
      target.write(value);
    },
  };
}

function importedTitle(name: string): string {
  return name.replace(/\.(?:txt|md)$/i, "").trim() || "Imported context";
}

export interface AIPersonalizationScreenProps {
  focus?: "writing-style" | "personalization";
}

/**
 * Back is the shared header's only (38.9 D-16, D-07). Its goBack() fires
 * beforeRemove, so the Writing Style guard below still prompts.
 */
export function AIPersonalizationScreen({
  focus,
}: AIPersonalizationScreenProps) {
  const { colors } = useTheme();
  // The last item scrolls fully above the shell FAB (38.4 D-52, OA-E3).
  const bottomClearance = useBottomClearance();
  const [style, setStyle] = useState<WritingStyle>(DEFAULT_STYLE);
  // Unsaved-work guard (D-13, D-34). The saved baseline starts as the initial
  // style; `load()` and `saveStyle()` move it through the pure
  // applyStyleLoad / applyStyleSave rules (reviews C4-M4, C5-L1, C6-L5).
  const [savedStyle, setSavedStyle] = useState<WritingStyle>(DEFAULT_STYLE);
  const styleSyncRef = useRef<StyleSyncState>(initialStyleSync(DEFAULT_STYLE));
  // The shown style, read synchronously by an async load or save.
  const styleRef = useRef(style);
  styleRef.current = style;
  // Each load() takes a style-read token; a successful Save invalidates every
  // token taken before it completed (review C6-L5).
  const styleReadSeqRef = useRef(0);
  const [sections, setSections] = useState<PersonalizationSection[]>([]);
  const [activeModel, setActiveModel] = useState<ActiveEstimateModel | null>(
    null,
  );
  const [estimate, setEstimate] = useState<PromptContextEstimate>(() =>
    estimatePromptContext({
      prompt: "",
      connection: "custom",
      model: "selected model",
      contextWindowTokens: null,
    }),
  );
  const [recomputing, setRecomputing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [savingStyle, setSavingStyle] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [editingUid, setEditingUid] = useState<string | null>(null);
  // Whether the open inline section edit differs from its section (C5-L7).
  const [sectionEditDirty, setSectionEditDirty] = useState(false);
  const [optionsUid, setOptionsUid] = useState<string | null>(null);
  const [deleteUid, setDeleteUid] = useState<string | null>(null);
  const storage = useMemo(createOpenRouterStorage, []);
  const directStorage = useMemo(createFileCatalogStorage, []);
  const scrollRef = useRef<ScrollView>(null);

  const scrollToFocusedSection = useCallback(
    (
      section: "writing-style" | "personalization",
      event: LayoutChangeEvent,
    ) => {
      if (focus !== section) return;
      scrollRef.current?.scrollTo({
        y: Math.max(0, event.nativeEvent.layout.y - SPACING.base),
        animated: false,
      });
    },
    [focus],
  );

  const load = useCallback(async () => {
    const exec = getExecutor();
    styleReadSeqRef.current += 1;
    const readToken = styleReadSeqRef.current;
    const [nextStyle, nextSections, connection] = await Promise.all([
      getWritingStyle(exec),
      listPersonalizationSections(exec),
      resolveActiveAiConnection(exec),
    ]);
    // Publish the read style only for a still-valid token and a style that is
    // clean against its baseline; an edit is never replaced by a refresh.
    const synced = applyStyleLoad(
      { ...styleSyncRef.current, current: styleRef.current },
      nextStyle,
      readToken,
    );
    styleSyncRef.current = synced;
    if (synced.current !== styleRef.current) {
      styleRef.current = synced.current;
      setStyle(synced.current);
    }
    setSavedStyle(synced.saved);
    setSections(nextSections);
    if (!connection) {
      setActiveModel(null);
      return;
    }
    let openRouterModel: OpenRouterModel | null = null;
    let contextWindowTokens: number | null = null;
    if (connection.lane === "openrouter") {
      const catalog = await loadCachedOpenRouterCatalog(storage);
      openRouterModel =
        catalog?.models.find((model) => model.id === connection.model) ?? null;
    } else if (connection.lane !== "custom") {
      const catalog = resolveActiveCatalog(
        await loadCachedCatalog(directStorage),
      );
      contextWindowTokens =
        catalog.contextWindows?.[connection.lane][connection.model] ?? null;
    }
    setActiveModel({
      lane: connection.lane,
      model: connection.model,
      openRouterModel,
      contextWindowTokens,
    });
  }, [directStorage, storage]);

  useEffect(() => {
    void load().catch((caught) => {
      Logger.error(LOG_SCOPE, "failed to load personalization", caught);
      setMessage("Couldn't load AI personalization. Please try again.");
    });
  }, [load]);

  const estimateInput = useMemo(
    () => personalizationEstimateSource(style, sections),
    [sections, style],
  );
  const debouncer = useMemo(
    () =>
      createEstimateDebouncer(() => {
        const model = activeModel;
        setEstimate(
          estimatePromptContext({
            prompt: estimateInput,
            connection: model?.lane ?? "custom",
            model: model?.model || "selected model",
            contextWindowTokens: model?.contextWindowTokens ?? null,
            openRouterModel: model?.openRouterModel ?? null,
          }),
        );
        setRecomputing(false);
      }),
    [activeModel, estimateInput],
  );

  useEffect(() => {
    setRecomputing(true);
    debouncer.schedule();
    return () => debouncer.cancel();
  }, [debouncer]);

  const formattedEstimate = formatEstimateCaption(
    estimate,
    activeModel?.model || "selected model",
  );
  const displayCost =
    activeModel?.lane === "openrouter"
      ? formattedEstimate.cost
      : estimateInput.length > 0
        ? COST_ESTIMATE_UNAVAILABLE
        : null;

  async function saveStyle() {
    if (savingStyle) return;
    setSavingStyle(true);
    const submitted = style;
    try {
      await updateWritingStyle(getExecutor(), submitted, localDateTime());
      // The baseline is exactly what was written; an edit typed while the
      // write was pending stays dirty, and earlier reads go stale.
      const synced = applyStyleSave(
        { ...styleSyncRef.current, current: styleRef.current },
        submitted,
        styleReadSeqRef.current,
      );
      styleSyncRef.current = synced;
      setSavedStyle(synced.saved);
      setMessage(null);
      showSnackbar({ kind: "success", label: "Saved" });
    } catch (caught) {
      Logger.error(LOG_SCOPE, "failed to save Writing Style", caught);
      setMessage("Couldn't save Writing Style. Please try again.");
    } finally {
      setSavingStyle(false);
    }
  }

  useEffect(() => {
    // A newly opened (or closed) inline edit starts clean.
    void editingUid;
    setSectionEditDirty(false);
  }, [editingUid]);

  // Back with unsaved Writing Style edits or a typed section draft prompts
  // (D-13, D-34; C5-L7). Save does not navigate, so the bypass stays false.
  const bypassRef = useRef(false);
  useDiscardKeepGuard({
    hasUnsavedChanges:
      isWritingStyleDirty(savedStyle, style) ||
      hasSectionDraftChanges({
        adding,
        draftTitle,
        draftBody,
        editingOpen: editingUid !== null,
        editDirty: sectionEditDirty,
      }),
    bypassRef,
  });

  async function addSection() {
    if (!draftTitle.trim()) return;
    try {
      await createPersonalizationSection(getExecutor(), {
        title: draftTitle,
        body: draftBody,
        now: localDateTime(),
      });
      setDraftTitle("");
      setDraftBody("");
      setAdding(false);
      await load();
    } catch (caught) {
      Logger.error(LOG_SCOPE, "failed to add personalization section", caught);
      setMessage("Couldn't add that section. Please try again.");
    }
  }

  async function importFile(replaceUid?: string) {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/plain", "text/markdown"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const text = await new File(asset.uri).text();
      if (replaceUid) {
        await replacePersonalizationSectionFromImport(
          getExecutor(),
          replaceUid,
          text,
          localDateTime(),
        );
      } else {
        await importPersonalizationSection(getExecutor(), {
          title: importedTitle(asset.name),
          text,
          now: localDateTime(),
        });
      }
      setOptionsUid(null);
      await load();
    } catch (caught) {
      Logger.error(LOG_SCOPE, "failed to import personalization", caught);
      setMessage("Couldn't import that text file. Please try again.");
    }
  }

  async function saveEditedSection(section: PersonalizationSection) {
    try {
      await updatePersonalizationSection(getExecutor(), {
        uid: section.uid,
        title: section.title,
        body: section.body,
        now: localDateTime(),
      });
      setEditingUid(null);
      await load();
    } catch (caught) {
      Logger.error(LOG_SCOPE, "failed to edit personalization section", caught);
      setMessage("Couldn't save that section. Please try again.");
    }
  }

  async function toggleSection(
    section: PersonalizationSection,
    enabled: boolean,
  ) {
    setSections((current) =>
      current.map((row) =>
        row.uid === section.uid ? { ...row, enabled } : row,
      ),
    );
    try {
      await setPersonalizationSectionEnabled(
        getExecutor(),
        section.uid,
        enabled,
        localDateTime(),
      );
    } catch (caught) {
      Logger.error(
        LOG_SCOPE,
        "failed to toggle personalization section",
        caught,
      );
      setSections((current) =>
        current.map((row) =>
          row.uid === section.uid ? { ...row, enabled: !enabled } : row,
        ),
      );
      setMessage("Couldn't update that section. Please try again.");
    }
  }

  async function moveSection(uid: string, direction: "up" | "down") {
    const next = moveSectionUid(
      sections.map((section) => section.uid),
      uid,
      direction,
    );
    if (next.every((value, index) => value === sections[index]?.uid)) return;
    try {
      await reorderPersonalizationSections(
        getExecutor(),
        next,
        localDateTime(),
      );
      await load();
    } catch (caught) {
      Logger.error(LOG_SCOPE, "failed to reorder personalization", caught);
      setMessage("Couldn't reorder those sections. Please try again.");
    }
  }

  async function confirmDelete() {
    if (!deleteUid) return;
    try {
      await deletePersonalizationSection(getExecutor(), deleteUid);
      setDeleteUid(null);
      setOptionsUid(null);
      await load();
    } catch (caught) {
      Logger.error(LOG_SCOPE, "failed to delete personalization", caught);
      setMessage("Couldn't delete that section. Please try again.");
    }
  }

  return (
    <View style={styles.root}>
      <ShellAppBar variant="child" title="AI Personalization" />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomClearance },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={styles.section}
          onLayout={(event) => scrollToFocusedSection("writing-style", event)}
        >
          <AppText role="heading">Writing Style</AppText>
          <StyleRow
            label="Tone"
            custom={style.tone === "custom"}
            options={TONE_OPTIONS}
            value={style.tone === "custom" ? "balanced" : style.tone}
            onChange={(tone) => setStyle((current) => ({ ...current, tone }))}
            onToggleCustom={() =>
              setStyle((current) => ({
                ...current,
                tone: current.tone === "custom" ? "balanced" : "custom",
              }))
            }
          />
          <StyleRow
            label="Length"
            custom={style.length === "custom"}
            options={LENGTH_OPTIONS}
            value={style.length === "custom" ? "normal" : style.length}
            onChange={(length) =>
              setStyle((current) => ({ ...current, length }))
            }
            onToggleCustom={() =>
              setStyle((current) => ({
                ...current,
                length: current.length === "custom" ? "normal" : "custom",
              }))
            }
          />
          <StyleRow
            label="Directness"
            custom={style.directness === "custom"}
            options={DIRECTNESS_OPTIONS}
            value={
              style.directness === "custom" ? "balanced" : style.directness
            }
            onChange={(directness) =>
              setStyle((current) => ({ ...current, directness }))
            }
            onToggleCustom={() =>
              setStyle((current) => ({
                ...current,
                directness:
                  current.directness === "custom" ? "balanced" : "custom",
              }))
            }
          />
          <AppText role="label">Custom guidance</AppText>
          <TextInput
            accessibilityLabel="Custom Writing Style guidance"
            multiline
            placeholder="Optional guidance in your own words"
            placeholderTextColor={colors.textPlaceholder}
            value={style.freeform}
            onChangeText={(freeform) =>
              setStyle((current) => ({ ...current, freeform }))
            }
            style={[
              styles.bodyInput,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.textPrimary,
              },
            ]}
          />
          <Button
            role="primary"
            label={savingStyle ? "Saving…" : "Save Writing Style"}
            disabled={savingStyle}
            onPress={() => void saveStyle()}
          />
        </View>

        <View
          style={styles.section}
          onLayout={(event) => scrollToFocusedSection("personalization", event)}
        >
          <View style={styles.sectionHeadingRow}>
            <AppText role="heading">Personalization Context</AppText>
            <Button
              role="secondary"
              label="Import .txt / .md"
              onPress={() => void importFile()}
            />
          </View>
          <AppText role="caption" style={{ color: colors.textSecondary }}>
            Enabled sections are sent to AI. Disabled sections stay on this
            device. Order is organizational only; every section has equal
            weight.
          </AppText>
          {sections.length === 0 ? (
            <GlassSurface density="dense" style={styles.card}>
              <AppText role="label">No personalization yet.</AppText>
              <ScopedPalette>
                {(scoped) => (
                  <AppText role="body" style={{ color: scoped.textSecondary }}>
                    {EMPTY_COPY}
                  </AppText>
                )}
              </ScopedPalette>
            </GlassSurface>
          ) : (
            sections.map((section, index) => (
              <GlassSurface
                key={section.uid}
                density="dense"
                style={styles.card}
              >
                <View style={styles.cardHeader}>
                  <Pressable
                    accessibilityRole="adjustable"
                    accessibilityLabel={`Reorder ${section.title}`}
                    accessibilityHint="Use Move up or Move down"
                    accessibilityActions={[
                      { name: "increment", label: "Move down" },
                      { name: "decrement", label: "Move up" },
                    ]}
                    onAccessibilityAction={(event) => {
                      const direction =
                        event.nativeEvent.actionName === "decrement"
                          ? "up"
                          : "down";
                      void moveSection(section.uid, direction);
                    }}
                    style={styles.iconTarget}
                  >
                    <Icon name="sort" tone="textSecondary" size="md" />
                  </Pressable>
                  <View style={styles.cardCopy}>
                    <AppText role="label">{section.title}</AppText>
                    <ScopedPalette>
                      {(scoped) => (
                        <AppText
                          role="body"
                          style={{ color: scoped.textSecondary }}
                        >
                          {section.body || "No section text yet."}
                        </AppText>
                      )}
                    </ScopedPalette>
                  </View>
                  <Switch
                    accessibilityLabel={`Send ${section.title} to AI`}
                    value={section.enabled}
                    onValueChange={(value) =>
                      void toggleSection(section, value)
                    }
                    trackColor={{ false: colors.border, true: colors.accent }}
                    thumbColor={colors.surfaceElevated}
                  />
                  <Button
                    role="iconOnly"
                    icon="overflow"
                    accessibilityLabel={`Section options for ${section.title}`}
                    onPress={() =>
                      setOptionsUid((current) =>
                        current === section.uid ? null : section.uid,
                      )
                    }
                  />
                </View>
                <View style={styles.moveActions}>
                  <Button
                    role="tertiary"
                    label="Move up"
                    disabled={index === 0}
                    onPress={() => void moveSection(section.uid, "up")}
                  />
                  <Button
                    role="tertiary"
                    label="Move down"
                    disabled={index === sections.length - 1}
                    onPress={() => void moveSection(section.uid, "down")}
                  />
                </View>
                {optionsUid === section.uid ? (
                  <View style={styles.options}>
                    <Button
                      role="tertiary"
                      label="Rename / edit"
                      onPress={() => {
                        setEditingUid(section.uid);
                        setOptionsUid(null);
                      }}
                    />
                    <Button
                      role="tertiary"
                      label="Replace from file"
                      onPress={() => void importFile(section.uid)}
                    />
                    <Button
                      role="destructive"
                      label="Delete section"
                      onPress={() => setDeleteUid(section.uid)}
                    />
                  </View>
                ) : null}
                {editingUid === section.uid ? (
                  <SectionEditor
                    section={section}
                    onCancel={() => setEditingUid(null)}
                    onSave={saveEditedSection}
                    onDirtyChange={setSectionEditDirty}
                  />
                ) : null}
              </GlassSurface>
            ))
          )}

          {adding ? (
            <NewSectionEditor
              title={draftTitle}
              body={draftBody}
              onTitleChange={setDraftTitle}
              onBodyChange={setDraftBody}
              onCancel={() => setAdding(false)}
              onSave={() => void addSection()}
            />
          ) : (
            <Button
              role="primary"
              label="Add / paste section"
              onPress={() => setAdding(true)}
            />
          )}
        </View>

        <GlassSurface density="dense" style={styles.estimateCard}>
          <ScopedPalette>
            {(scoped) => (
              <>
                <AppText role="caption">{formattedEstimate.context}</AppText>
                {recomputing ? (
                  <AppText
                    role="caption"
                    style={{ color: scoped.textSecondary }}
                  >
                    Recalculating…
                  </AppText>
                ) : null}
                {displayCost ? (
                  <AppText
                    role="caption"
                    style={{ color: scoped.textSecondary }}
                  >
                    {displayCost}
                  </AppText>
                ) : null}
                {formattedEstimate.overflow ? (
                  <View
                    style={[styles.warning, { borderColor: scoped.danger }]}
                  >
                    <Icon name="warning" tone="danger" size="sm" />
                    <AppText role="body" style={{ color: scoped.danger }}>
                      {formattedEstimate.overflow}
                    </AppText>
                  </View>
                ) : null}
              </>
            )}
          </ScopedPalette>
        </GlassSurface>

        {message ? (
          <AppText role="body" style={{ color: colors.textSecondary }}>
            {message}
          </AppText>
        ) : null}
      </ScrollView>
      <ConfirmDialog
        visible={deleteUid !== null}
        destructive
        title="Delete personalization section?"
        message="This removes the saved section from this device."
        confirmLabel="Delete section"
        onConfirm={() => void confirmDelete()}
        onRequestClose={() => setDeleteUid(null)}
      />
    </View>
  );
}

interface StyleRowProps<V extends string> {
  label: string;
  custom: boolean;
  options: Array<{ label: string; value: V }>;
  value: V;
  onChange: (value: V) => void;
  onToggleCustom: () => void;
}

function StyleRow<V extends string>({
  label,
  custom,
  options,
  value,
  onChange,
  onToggleCustom,
}: StyleRowProps<V>) {
  return (
    <View style={styles.styleRow}>
      <AppText role="label">{label}</AppText>
      <SegmentedControl
        testID={`writing-style-${label.toLowerCase()}`}
        options={options}
        value={value}
        onChange={onChange}
      />
      <Button
        role="tertiary"
        label={custom ? `Use ${label} controls` : "Use custom guidance instead"}
        onPress={onToggleCustom}
      />
    </View>
  );
}

function NewSectionEditor({
  title,
  body,
  onTitleChange,
  onBodyChange,
  onCancel,
  onSave,
}: {
  title: string;
  body: string;
  onTitleChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const { colors } = useTheme();
  return (
    <GlassSurface density="dense" style={styles.card}>
      <AppText role="label">New personalization section</AppText>
      <TextInput
        accessibilityLabel="Section title"
        placeholder="Section title"
        placeholderTextColor={colors.textPlaceholder}
        value={title}
        onChangeText={onTitleChange}
        style={[
          styles.input,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            color: colors.textPrimary,
          },
        ]}
      />
      <TextInput
        accessibilityLabel="Section text"
        multiline
        placeholder="Paste or type context"
        placeholderTextColor={colors.textPlaceholder}
        value={body}
        onChangeText={onBodyChange}
        style={[
          styles.bodyInput,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            color: colors.textPrimary,
          },
        ]}
      />
      <View style={styles.options}>
        <Button role="secondary" label="Cancel" onPress={onCancel} />
        <Button role="primary" label="Save section" onPress={onSave} />
      </View>
    </GlassSurface>
  );
}

function SectionEditor({
  section,
  onCancel,
  onSave,
  onDirtyChange,
}: {
  section: PersonalizationSection;
  onCancel: () => void;
  onSave: (section: PersonalizationSection) => Promise<void>;
  /** Reports whether the edit differs from its section (D-13; C5-L7). */
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [title, setTitle] = useState(section.title);
  const [body, setBody] = useState(section.body);
  const dirty = title !== section.title || body !== section.body;
  const onDirtyChangeRef = useRef(onDirtyChange);
  onDirtyChangeRef.current = onDirtyChange;
  useEffect(() => {
    onDirtyChangeRef.current?.(dirty);
  }, [dirty]);
  useEffect(() => () => onDirtyChangeRef.current?.(false), []);
  return (
    <NewSectionEditor
      title={title}
      body={body}
      onTitleChange={setTitle}
      onBodyChange={setBody}
      onCancel={onCancel}
      onSave={() => void onSave({ ...section, title, body })}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    padding: SPACING.base,
    paddingBottom: SPACING["2xl"],
    gap: SPACING.xl,
  },
  section: { gap: SPACING.base },
  sectionHeadingRow: {
    gap: SPACING.md,
  },
  styleRow: { gap: SPACING.sm },
  card: { padding: SPACING.base },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },
  cardCopy: { flex: 1, gap: SPACING.xs },
  iconTarget: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    alignItems: "center",
    justifyContent: "center",
  },
  moveActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  options: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  input: {
    minHeight: MIN_TOUCH_TARGET,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADII.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  bodyInput: {
    minHeight: 120,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADII.md,
    padding: SPACING.md,
    textAlignVertical: "top",
  },
  estimateCard: { padding: SPACING.base, gap: SPACING.xs },
  warning: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADII.md,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },
});
