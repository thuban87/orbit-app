// biome-ignore-all lint/a11y/useValidAriaRole: `role` is Orbit's visual/typography domain prop.
import * as DocumentPicker from "expo-document-picker";
import { Directory, File, Paths } from "expo-file-system";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AccessibilityInfo,
  findNodeHandle,
  type LayoutChangeEvent,
  Pressable,
  type ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import {
  NestedReorderableList,
  type ReorderableListReorderEvent,
  ScrollViewContainer,
  useReorderableDrag,
} from "react-native-reorderable-list";
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
  MIN_TOUCH_TARGET,
  OrbitSwitch,
} from "@/components/ui";
import {
  AnchoredMenu,
  type AnchoredMenuItem,
} from "@/components/ui/AnchoredMenu";
import { SettingsSectionCard } from "@/components/ui/SettingsSectionCard";
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
import { beginInFlight, endInFlight } from "@/utils/single-flight";
import {
  applyStyleLoad,
  applyStyleSave,
  createEstimateDebouncer,
  customGuidanceCaption,
  formatEstimateCaption,
  hasSectionDraftChanges,
  initialStyleSync,
  isWritingStyleDirty,
  moveSectionUid,
  orderSectionsByUid,
  personalizationEstimateSource,
  reorderSectionUids,
  type StyleSyncState,
  usesCustomGuidance,
} from "./ai-personalization-logic";

const LOG_SCOPE = "ai-personalization";
/** The load error, also shown when a re-read after a committed write fails. */
const LOAD_FAILED_MESSAGE =
  "Couldn't load AI personalization. Please try again.";
const EMPTY_COPY =
  "Add a section or paste text to tell Orbit how you write and what matters to you.";

const DEFAULT_STYLE: WritingStyle = {
  tone: "balanced",
  length: "normal",
  directness: "balanced",
  freeform: "",
};

/**
 * Each Writing Style choice offers its presets plus Custom (38.12 D-87): a
 * custom choice is its own selected segment, so no preset reads as selected
 * beside it.
 */
const CUSTOM_OPTION = { label: "Custom", value: "custom" } as const;

const TONE_OPTIONS = [
  { label: "Casual", value: "casual" },
  { label: "Balanced", value: "balanced" },
  { label: "Polished", value: "polished" },
  CUSTOM_OPTION,
] satisfies Array<{ label: string; value: WritingTone }>;

const LENGTH_OPTIONS = [
  { label: "Concise", value: "concise" },
  { label: "Normal", value: "normal" },
  { label: "Detailed", value: "detailed" },
  CUSTOM_OPTION,
] satisfies Array<{ label: string; value: WritingLength }>;

const DIRECTNESS_OPTIONS = [
  { label: "Gentle", value: "gentle" },
  { label: "Balanced", value: "balanced" },
  { label: "Direct", value: "direct" },
  CUSTOM_OPTION,
] satisfies Array<{ label: string; value: WritingDirectness }>;

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
  // A section add or edit is saving (the header's disabled Back; WR-02).
  const [savingSection, setSavingSection] = useState(false);
  // A section reorder (drag or Move up / Move down) is saving: the list's
  // handles and menus hold so two reorders never race (38.12 D-120).
  const [reordering, setReordering] = useState(false);
  const reorderingRef = useRef(false);
  // Synchronous in-flight flag shared by the three saves the guard covers
  // (Writing Style, new section, section edit): the guard reads it to hold
  // Back while one runs (fix-pass WR-02); one save at a time.
  const savingRef = useRef(false);
  // Any of those saves in flight drops a section Save (the shared ref) and
  // holds the section forms' Cancel, so both draw disabled (D-26; WR-02
  // follow-up). It also holds each section's options (Rename / edit,
  // Replace from file, Delete section; third fix pass WR-02).
  const sectionFormBusy = savingStyle || savingSection;
  // The section list (drag handles, ⋯ menus, switches) also holds while a
  // reorder saves (38.12 D-120, D-88).
  const listBusy = sectionFormBusy || reordering;
  const [adding, setAdding] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [editingUid, setEditingUid] = useState<string | null>(null);
  // Whether the open inline section edit differs from its section (C5-L7).
  const [sectionEditDirty, setSectionEditDirty] = useState(false);
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
      setMessage(LOAD_FAILED_MESSAGE);
    });
  }, [load]);

  // A re-read after a committed write runs OUTSIDE that write's try, with
  // its own catch (third fix pass IN-02): a failed re-read shows the load
  // error and is never reported as a failed write. Reporting it as one
  // invited a retry that wrote the section a second time.
  const reloadAfterWrite = useCallback(async (): Promise<void> => {
    try {
      await load();
    } catch (caught) {
      Logger.error(
        LOG_SCOPE,
        "failed to reload personalization after a write",
        caught,
      );
      setMessage(LOAD_FAILED_MESSAGE);
    }
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
    if (!beginInFlight(savingRef)) return;
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
      endInFlight(savingRef);
      settleHold();
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
  const { settleHold } = useDiscardKeepGuard({
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
    // A Writing Style or section save in flight holds every exit, with no
    // prompt (fix-pass WR-02).
    busyRef: savingRef,
  });

  async function addSection() {
    if (!draftTitle.trim()) return;
    if (!beginInFlight(savingRef)) return;
    setSavingSection(true);
    let committed = false;
    try {
      await createPersonalizationSection(getExecutor(), {
        title: draftTitle,
        body: draftBody,
        now: localDateTime(),
      });
      committed = true;
      setDraftTitle("");
      setDraftBody("");
      setAdding(false);
    } catch (caught) {
      Logger.error(LOG_SCOPE, "failed to add personalization section", caught);
      setMessage("Couldn't add that section. Please try again.");
    } finally {
      setSavingSection(false);
      endInFlight(savingRef);
      settleHold();
    }
    if (committed) await reloadAfterWrite();
  }

  async function importFile(replaceUid?: string) {
    let committed = false;
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
      committed = true;
    } catch (caught) {
      Logger.error(LOG_SCOPE, "failed to import personalization", caught);
      setMessage("Couldn't import that text file. Please try again.");
    }
    if (committed) await reloadAfterWrite();
  }

  async function saveEditedSection(section: PersonalizationSection) {
    if (!beginInFlight(savingRef)) return;
    setSavingSection(true);
    let committed = false;
    try {
      await updatePersonalizationSection(getExecutor(), {
        uid: section.uid,
        title: section.title,
        body: section.body,
        now: localDateTime(),
      });
      committed = true;
      setEditingUid(null);
    } catch (caught) {
      Logger.error(LOG_SCOPE, "failed to edit personalization section", caught);
      setMessage("Couldn't save that section. Please try again.");
    } finally {
      setSavingSection(false);
      endInFlight(savingRef);
      settleHold();
    }
    if (committed) await reloadAfterWrite();
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

  /**
   * Persist a new section order (38.12 D-120): a drag and Move up / Move down
   * both land here, through the one reorder write. The new order shows at once
   * so a dropped row does not jump back; a failed write restores the old one.
   */
  async function persistSectionOrder(nextUids: string[]) {
    if (savingRef.current || reorderingRef.current) return;
    const prior = sections;
    if (nextUids.every((uid, index) => uid === prior[index]?.uid)) return;
    reorderingRef.current = true;
    setReordering(true);
    setSections(orderSectionsByUid(prior, nextUids));
    let committed = false;
    try {
      await reorderPersonalizationSections(
        getExecutor(),
        nextUids,
        localDateTime(),
      );
      committed = true;
    } catch (caught) {
      Logger.error(LOG_SCOPE, "failed to reorder personalization", caught);
      setSections(prior);
      setMessage("Couldn't reorder those sections. Please try again.");
    } finally {
      reorderingRef.current = false;
      setReordering(false);
    }
    if (committed) await reloadAfterWrite();
  }

  function moveSection(uid: string, direction: "up" | "down") {
    void persistSectionOrder(
      moveSectionUid(
        sections.map((section) => section.uid),
        uid,
        direction,
      ),
    );
  }

  function dropSection({ from, to }: ReorderableListReorderEvent) {
    void persistSectionOrder(
      reorderSectionUids(
        sections.map((section) => section.uid),
        from,
        to,
      ),
    );
  }

  async function confirmDelete() {
    if (!deleteUid) return;
    try {
      await deletePersonalizationSection(getExecutor(), deleteUid);
      setDeleteUid(null);
    } catch (caught) {
      Logger.error(LOG_SCOPE, "failed to delete personalization", caught);
      setMessage("Couldn't delete that section. Please try again.");
      return;
    }
    await reloadAfterWrite();
  }

  return (
    <View style={styles.root}>
      {/* While a save runs the guard holds Back (D-26; WR-02). */}
      <ShellAppBar
        variant="child"
        title="AI Personalization"
        backDisabled={savingStyle || savingSection}
      />
      {/* The one scroll container; the section list nests inside it so a
          drag scrolls the page (ProfileLayoutEditor precedent, D-29). */}
      <ScrollViewContainer
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
          <SettingsSectionCard title="Writing Style">
            <View key="style" style={styles.cardBody}>
              <StyleRow
                label="Tone"
                options={TONE_OPTIONS}
                value={style.tone}
                disabled={sectionFormBusy}
                onChange={(tone) =>
                  setStyle((current) => ({ ...current, tone }))
                }
              />
              <StyleRow
                label="Length"
                options={LENGTH_OPTIONS}
                value={style.length}
                disabled={sectionFormBusy}
                onChange={(length) =>
                  setStyle((current) => ({ ...current, length }))
                }
              />
              <StyleRow
                label="Directness"
                options={DIRECTNESS_OPTIONS}
                value={style.directness}
                disabled={sectionFormBusy}
                onChange={(directness) =>
                  setStyle((current) => ({ ...current, directness }))
                }
              />
              {/* The guidance is sent only while a choice is Custom (D-127), so
              its box shows only then; hiding it keeps the stored text. */}
              {usesCustomGuidance(style) ? (
                <View style={styles.styleRow}>
                  <AppText role="label">Custom guidance</AppText>
                  <AppText
                    role="caption"
                    style={{ color: colors.textSecondary }}
                  >
                    {customGuidanceCaption(style)}
                  </AppText>
                  <TextInput
                    accessibilityLabel="Custom Writing Style guidance"
                    multiline
                    editable={!sectionFormBusy}
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
                </View>
              ) : null}
              <Button
                role="primary"
                label={savingStyle ? "Saving…" : "Save Writing Style"}
                disabled={savingStyle || savingSection}
                onPress={() => void saveStyle()}
              />
            </View>
          </SettingsSectionCard>
        </View>

        <View
          style={styles.section}
          onLayout={(event) => scrollToFocusedSection("personalization", event)}
        >
          <SettingsSectionCard title="Personalization Context">
            <View key="context" style={styles.cardBody}>
              <View style={styles.sectionHeadingRow}>
                <Button
                  role="secondary"
                  label="Import .txt / .md"
                  disabled={listBusy}
                  onPress={() => {
                    if (savingRef.current) return;
                    void importFile();
                  }}
                />
              </View>
              <AppText role="caption" style={{ color: colors.textSecondary }}>
                Enabled sections are sent to AI. Disabled sections stay on this
                device. Order is organizational only; every section has equal
                weight.
              </AppText>
              {sections.length === 0 ? (
                <View style={styles.emptyState}>
                  <AppText role="label">No personalization yet.</AppText>
                  <AppText role="body" style={{ color: colors.textSecondary }}>
                    {EMPTY_COPY}
                  </AppText>
                </View>
              ) : (
                <NestedReorderableList
                  data={sections}
                  keyExtractor={(section) => section.uid}
                  onReorder={dropSection}
                  // Rows read the screen's busy and editing state, which the list
                  // data does not carry.
                  extraData={{ editingUid, listBusy }}
                  renderItem={({ item: section, index }) => (
                    <PersonalizationSectionCard
                      section={section}
                      index={index}
                      total={sections.length}
                      busy={listBusy}
                      onToggle={(enabled) => {
                        if (savingRef.current || reorderingRef.current) return;
                        void toggleSection(section, enabled);
                      }}
                      onEdit={() => {
                        if (savingRef.current) return;
                        setEditingUid(section.uid);
                      }}
                      onReplace={() => {
                        if (savingRef.current) return;
                        void importFile(section.uid);
                      }}
                      onMove={(direction) =>
                        moveSection(section.uid, direction)
                      }
                      onDelete={() => {
                        if (savingRef.current) return;
                        setDeleteUid(section.uid);
                      }}
                    >
                      {editingUid === section.uid ? (
                        <SectionEditor
                          section={section}
                          onCancel={() => setEditingUid(null)}
                          onSave={saveEditedSection}
                          onDirtyChange={setSectionEditDirty}
                          busy={sectionFormBusy}
                        />
                      ) : null}
                    </PersonalizationSectionCard>
                  )}
                  scrollable={false}
                  // The outer ScrollViewContainer is the only scroll container
                  // (ProfileLayoutEditor D-29); drag still pauses its scroll.
                  scrollEnabled={false}
                />
              )}

              {adding ? (
                <NewSectionEditor
                  title={draftTitle}
                  body={draftBody}
                  onTitleChange={setDraftTitle}
                  onBodyChange={setDraftBody}
                  onCancel={() => setAdding(false)}
                  onSave={() => void addSection()}
                  busy={sectionFormBusy}
                />
              ) : (
                <Button
                  role="primary"
                  label="Add / paste section"
                  disabled={sectionFormBusy}
                  onPress={() => setAdding(true)}
                />
              )}
            </View>
          </SettingsSectionCard>
        </View>

        <SettingsSectionCard>
          <View key="estimate" style={styles.cardBody}>
            <AppText role="caption">{formattedEstimate.context}</AppText>
            {recomputing ? (
              <AppText role="caption" style={{ color: colors.textSecondary }}>
                Recalculating…
              </AppText>
            ) : null}
            {displayCost ? (
              <AppText role="caption" style={{ color: colors.textSecondary }}>
                {displayCost}
              </AppText>
            ) : null}
            {formattedEstimate.overflow ? (
              <View style={[styles.warning, { borderColor: colors.danger }]}>
                <Icon name="warning" tone="danger" size="sm" />
                <AppText role="body" style={{ color: colors.danger }}>
                  {formattedEstimate.overflow}
                </AppText>
              </View>
            ) : null}
          </View>
        </SettingsSectionCard>

        {message ? (
          <AppText role="body" style={{ color: colors.textSecondary }}>
            {message}
          </AppText>
        ) : null}
      </ScrollViewContainer>
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
  /** The presets plus Custom (D-87). */
  options: Array<{ label: string; value: V }>;
  value: V;
  onChange: (value: V) => void;
  /** A save is in flight: the choice is held (D-88). */
  disabled: boolean;
}

function StyleRow<V extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
}: StyleRowProps<V>) {
  return (
    <View style={styles.styleRow}>
      <AppText role="label">{label}</AppText>
      <SegmentedControl
        testID={`writing-style-${label.toLowerCase()}`}
        options={options}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
    </View>
  );
}

/**
 * One personalization section in the shared list pattern (38.12 D-86, D-120;
 * Categories is the reference): a drag handle, the title, its Send-to-AI
 * switch and a ⋯ holding every action, Delete section last. The section text
 * spans the full card width under that row. `busy` holds the handle, the ⋯ and
 * the switch while a save or reorder runs (D-26, D-88).
 */
function PersonalizationSectionCard({
  section,
  index,
  total,
  busy,
  onToggle,
  onEdit,
  onReplace,
  onMove,
  onDelete,
  children,
}: {
  section: PersonalizationSection;
  index: number;
  total: number;
  busy: boolean;
  onToggle: (enabled: boolean) => void;
  onEdit: () => void;
  onReplace: () => void;
  onMove: (direction: "up" | "down") => void;
  onDelete: () => void;
  /** The inline section editor, while this section is being edited. */
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  const drag = useReorderableDrag();
  const anchorRef = useRef<View>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    // Focus returns to the ⋯ that opened the menu.
    requestAnimationFrame(() => {
      const node = findNodeHandle(anchorRef.current);
      if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
    });
  }, []);
  const items: AnchoredMenuItem[] = [
    { id: "edit", label: "Rename / edit", icon: "edit", onPress: onEdit },
    { id: "replace", label: "Replace from file", onPress: onReplace },
    ...(index > 0
      ? [
          {
            id: "up",
            label: "Move up",
            icon: "sort" as const,
            onPress: () => onMove("up"),
          },
        ]
      : []),
    ...(index < total - 1
      ? [
          {
            id: "down",
            label: "Move down",
            icon: "sort" as const,
            onPress: () => onMove("down"),
          },
        ]
      : []),
    {
      id: "delete",
      label: "Delete section",
      icon: "warning",
      danger: true,
      separatorBefore: true,
      onPress: onDelete,
    },
  ];
  return (
    <View
      testID={`personalization-section-${section.uid}`}
      style={[
        styles.sectionRow,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.cardHeader}>
        <Pressable
          testID={`personalization-drag-${section.uid}`}
          accessibilityRole="button"
          accessibilityLabel={`Reorder ${section.title}`}
          accessibilityHint="Long press and drag to reorder sections"
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onLongPress={drag}
          style={styles.iconTarget}
        >
          <Icon name="sort" tone="textSecondary" size="md" />
        </Pressable>
        <AppText role="label" style={styles.cardTitle}>
          {section.title}
        </AppText>
        <OrbitSwitch
          accessibilityLabel={`Send ${section.title} to AI`}
          value={section.enabled}
          busy={busy}
          onValueChange={onToggle}
        />
        <Pressable
          ref={anchorRef}
          testID={`personalization-options-${section.uid}`}
          collapsable={false}
          accessibilityRole="button"
          accessibilityLabel={`Options for ${section.title}`}
          accessibilityState={{ expanded: menuOpen, disabled: busy }}
          disabled={busy}
          onPress={() => setMenuOpen(true)}
          style={styles.iconTarget}
        >
          <Icon name="overflow" tone="textSecondary" size="md" />
        </Pressable>
      </View>
      <AppText role="body" style={{ color: colors.textSecondary }}>
        {section.body || "No section text yet."}
      </AppText>
      {children}
      <AnchoredMenu
        anchorRef={anchorRef}
        visible={menuOpen}
        accessibilityLabel={`Options for ${section.title}`}
        items={items}
        onRequestClose={closeMenu}
      />
    </View>
  );
}

/** The section form's heading: adding vs editing (38.12-15 fold). */
export const SECTION_FORM_HEADING = {
  add: "New personalization section",
  edit: "Edit section",
} as const;

function NewSectionEditor({
  title,
  body,
  onTitleChange,
  onBodyChange,
  onCancel,
  onSave,
  busy = false,
  framed = true,
  heading = SECTION_FORM_HEADING.add,
}: {
  title: string;
  body: string;
  onTitleChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
  /**
   * A save is in flight (WR-02 follow-up; D-13, D-14): Cancel and Save
   * section are held and drawn disabled (D-26). Absent → false.
   */
  busy?: boolean;
  /**
   * Draw the form as its own bordered row (the Add form, D-119). The inline
   * edit form sits inside its section's row, so it is drawn unframed.
   */
  framed?: boolean;
  /** The form's heading; the inline edit form passes the edit heading. */
  heading?: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.form,
        framed
          ? [
              styles.sectionRow,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]
          : null,
      ]}
    >
      <AppText role="label">{heading}</AppText>
      <TextInput
        accessibilityLabel="Section title"
        editable={!busy}
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
        editable={!busy}
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
        <Button
          role="secondary"
          label="Cancel"
          disabled={busy}
          onPress={onCancel}
        />
        <Button
          role="primary"
          label="Save section"
          disabled={busy}
          onPress={onSave}
        />
      </View>
    </View>
  );
}

function SectionEditor({
  section,
  onCancel,
  onSave,
  onDirtyChange,
  busy = false,
}: {
  section: PersonalizationSection;
  onCancel: () => void;
  onSave: (section: PersonalizationSection) => Promise<void>;
  /** Reports whether the edit differs from its section (D-13; C5-L7). */
  onDirtyChange?: (dirty: boolean) => void;
  /** A save is in flight: Cancel and Save section are held (WR-02 follow-up). */
  busy?: boolean;
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
      busy={busy}
      framed={false}
      heading={SECTION_FORM_HEADING.edit}
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
  // A shared section card's content brings its own padding (D-119).
  cardBody: { padding: SPACING.base, gap: SPACING.base },
  emptyState: { gap: SPACING.xs },
  form: { gap: SPACING.sm },
  // A section row in the shared list pattern (Categories' row look, D-120).
  sectionRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADII.md,
    padding: SPACING.md,
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  cardTitle: { flex: 1 },
  iconTarget: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    alignItems: "center",
    justifyContent: "center",
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
  warning: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADII.md,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },
});
