// biome-ignore-all lint/a11y/useValidAriaRole: AppText/Button semantic roles are domain props.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, TextInput, View } from "react-native";
import { ContactPicker } from "@/components/ContactPicker";
import { CategoryChoiceSheet } from "@/components/category/CategoryChoiceSheet";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { GlassSurface } from "@/components/ui/GlassSurface";
import { Sheet } from "@/components/ui/Sheet";
import { listCategories } from "@/db/contact-read";
import { getExecutor, localDateTime } from "@/db/database";
import {
  assignCategoryProfilePresentation,
  assignContactLayoutTemplate,
  assignGlobalProfileLayoutTemplate,
  createProfileLayoutTemplate,
  deleteProfileLayoutTemplate,
  updateProfileLayoutTemplate,
} from "@/db/profile-presentation-dao";
import {
  countProfileTemplateUsage,
  listProfileLayoutTemplates,
  type ProfileLayoutTemplateRow,
  type ProfileTemplateUsage,
  readCategoryProfilePresentation,
} from "@/db/profile-presentation-read";
import { newUid } from "@/db/uid";
import { confirmDiscard } from "@/navigation/discard-keep-guard";
import { parseAndCanonicalizeProfileLayout } from "@/profile/presentation-schema";
import {
  activeTemplateManagerPage,
  beginTemplateManagerListLoad,
  beginTemplateOperation,
  clearTemplateDraft,
  createTemplateManagerListLoadState,
  createTemplateManagerState,
  describeAssignmentKind,
  describeCurrentLayout,
  describeTemplateAssignment,
  effectiveLayoutTemplateUid,
  finishTemplateManagerListLoad,
  managerBackIntent,
  openTemplateManagerPage,
  type ProfileLayoutSource,
  popTemplateManagerPage,
  retainTemplateFailure,
  setTemplateDraft,
  setTemplateUsage,
  settleTemplateOperation,
  type TemplateManagerState,
  templateLayoutForDisplay,
  templateLayoutForNewTemplate,
  templatePreviewLines,
} from "@/profile/template-manager-model";
import type {
  ProfileLayoutDocument,
  ProfilePresentationInputs,
} from "@/profile/types";
import { useShellRefresh } from "@/stores/shell-refresh-store";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { ProfileLayoutEditor } from "./ProfileLayoutEditor";

export interface ProfileTemplateManagerProps {
  visible: boolean;
  contactId: number;
  contactName: string;
  /**
   * Resolved source remains explicit so inherited and override rows never
   * merge. Shown to the user only through `describeCurrentLayout` (38.11-13).
   */
  effectiveLayoutSource: ProfileLayoutSource;
  /** The contact's current freeform layout, if any, for Save Current Layout. */
  freeformLayout: ProfileLayoutDocument | null;
  /** An unsaved canonical editor draft, preferred over any persisted freeform layout. */
  pendingTemplateLayout?: ProfileLayoutDocument | null;
  /** Current hierarchy inputs let layout writes retain the independent background axis. */
  presentation: ProfilePresentationInputs;
  onRequestClose: () => void;
  /** Called only after a durable create/edit/assignment/delete succeeds. */
  onCommitted?: () => void;
  /** Clears a consumed editor handoff only after the new template is durable. */
  onPendingTemplateResolved?: () => void;
}

type Category = { id: number; uid?: string; name: string };

function usageText(usage: ProfileTemplateUsage | undefined): string {
  if (!usage) return "Checking usage…";
  return `${usage.total} assignment${usage.total === 1 ? "" : "s"} · ${usage.global} global · ${usage.categories} Category · ${usage.contacts} contact`;
}

/** The stored layout as saved; Rename writes it back unchanged. */
function templateLayout(row: ProfileLayoutTemplateRow): ProfileLayoutDocument {
  return parseAndCanonicalizeProfileLayout(row.layoutJson);
}

function isTemplatePage(
  page: ReturnType<typeof activeTemplateManagerPage>,
): page is Exclude<
  ReturnType<typeof activeTemplateManagerPage>,
  { kind: "list" | "create" }
> {
  return "templateUid" in page;
}

export function ProfileTemplateManager({
  visible,
  contactId,
  contactName,
  effectiveLayoutSource,
  freeformLayout,
  pendingTemplateLayout = null,
  presentation,
  onRequestClose,
  onCommitted,
  onPendingTemplateResolved,
}: ProfileTemplateManagerProps) {
  const { colors } = useTheme();
  const [state, setState] = useState<TemplateManagerState>(
    createTemplateManagerState,
  );
  const [templates, setTemplates] = useState<ProfileLayoutTemplateRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [listLoad, setListLoad] = useState(createTemplateManagerListLoadState);
  const [editingLayout, setEditingLayout] = useState<{
    uid: string | null;
    name: string;
    layout: ProfileLayoutDocument;
  } | null>(null);
  const [deleteUid, setDeleteUid] = useState<string | null>(null);
  const [assignCreatedTemplate, setAssignCreatedTemplate] = useState(false);
  const [contactPickerVisible, setContactPickerVisible] = useState(false);
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  const pendingTemplateUids = useRef(new Set<string>());

  const activePage = activeTemplateManagerPage(state);
  const activeTemplate = useMemo(
    () =>
      isTemplatePage(activePage)
        ? (templates.find((row) => row.uid === activePage.templateUid) ?? null)
        : null,
    [activePage, templates],
  );
  const currentLayoutForNewTemplate = templateLayoutForNewTemplate({
    pendingTemplateLayout,
    freeformLayout,
  });

  const refresh = useCallback(async () => {
    const exec = getExecutor();
    const [nextTemplates, nextCategories] = await Promise.all([
      listProfileLayoutTemplates(exec),
      listCategories(exec),
    ]);
    const usageEntries = await Promise.all(
      nextTemplates.map(
        async (template) =>
          [
            template.uid,
            await countProfileTemplateUsage(exec, "layout", template.uid),
          ] as const,
      ),
    );
    setTemplates(nextTemplates);
    setCategories(nextCategories);
    setState((current) =>
      usageEntries.reduce(
        (next, [uid, usage]) => setTemplateUsage(next, uid, usage),
        current,
      ),
    );
  }, []);
  useShellRefresh(() => {
    if (visible) void refresh();
  });

  const loadList = useCallback(async () => {
    setListLoad(beginTemplateManagerListLoad());
    try {
      await refresh();
      setListLoad(finishTemplateManagerListLoad(null));
    } catch {
      setListLoad(
        finishTemplateManagerListLoad(
          "Couldn't load layout templates. Try again.",
        ),
      );
    }
  }, [refresh]);

  useEffect(() => {
    if (!visible) return;
    void loadList();
  }, [loadList, visible]);

  const closeOrBack = () => {
    const intent = managerBackIntent(state);
    if (intent.kind === "pop-page") {
      setState(popTemplateManagerPage(state));
      return;
    }
    if (intent.kind === "close-sheet") {
      onRequestClose();
      return;
    }
    // The shared themed discard prompt (D-13, D-52).
    void confirmDiscard().then((discard) => {
      if (!discard) return;
      setState(clearTemplateDraft(state));
      onRequestClose();
    });
  };

  const runTemplateOperation = async (
    uid: string,
    operation: () => Promise<void>,
  ): Promise<boolean> => {
    if (pendingTemplateUids.current.has(uid)) return false;
    const started = beginTemplateOperation(state, uid);
    if (!started.accepted) return false;
    pendingTemplateUids.current.add(uid);
    setState(started.state);
    try {
      await operation();
      setState((current) => settleTemplateOperation(current, uid));
      await refresh();
      onCommitted?.();
      pendingTemplateUids.current.delete(uid);
      return true;
    } catch (error) {
      setState((current) =>
        retainTemplateFailure(
          current,
          uid,
          error instanceof Error
            ? error.message
            : "Couldn't save this template. Try again.",
        ),
      );
      pendingTemplateUids.current.delete(uid);
      return false;
    }
  };

  const saveNewTemplate = () => {
    const draft = state.draft;
    if (!draft) return;
    const uid = newUid();
    void (async () => {
      const saved = await runTemplateOperation(uid, async () => {
        await createProfileLayoutTemplate(getExecutor(), {
          uid,
          name: draft.name,
          layout: draft.layout,
          now: localDateTime(),
        });
      });
      if (saved) {
        setState((current) => {
          const cleared = clearTemplateDraft(current);
          return assignCreatedTemplate
            ? openTemplateManagerPage(cleared, {
                kind: "assignment",
                templateUid: uid,
              })
            : cleared;
        });
        if (pendingTemplateLayout) onPendingTemplateResolved?.();
        setAssignCreatedTemplate(false);
      }
    })();
  };

  const openUsage = async (uid: string) => {
    try {
      const usage = await countProfileTemplateUsage(
        getExecutor(),
        "layout",
        uid,
      );
      setState((current) =>
        openTemplateManagerPage(setTemplateUsage(current, uid, usage), {
          kind: "usage",
          templateUid: uid,
        }),
      );
    } catch {
      setState((current) => ({
        ...current,
        error: "Couldn't refresh template usage. Try again.",
      }));
    }
  };

  const requestDelete = async (uid: string) => {
    try {
      const usage = await countProfileTemplateUsage(
        getExecutor(),
        "layout",
        uid,
      );
      setState((current) => setTemplateUsage(current, uid, usage));
      setDeleteUid(uid);
    } catch {
      setState((current) => ({
        ...current,
        error: "Couldn't check template usage. Try again.",
      }));
    }
  };

  const assign = (
    scope: "global" | "category" | "contact" | "inherit",
    targetContactId = contactId,
    categoryId?: number,
  ) => {
    if (!activeTemplate) return;
    void runTemplateOperation(activeTemplate.uid, async () => {
      const now = localDateTime();
      if (scope === "global") {
        await assignGlobalProfileLayoutTemplate(getExecutor(), {
          templateUid: activeTemplate.uid,
          now,
        });
      } else if (scope === "category" && categoryId !== undefined) {
        const current = await readCategoryProfilePresentation(
          getExecutor(),
          categoryId,
        );
        await assignCategoryProfilePresentation(getExecutor(), {
          categoryId,
          layoutTemplateUid: activeTemplate.uid,
          backgroundTemplateUid: current.backgroundTemplateUid,
          now,
        });
      } else if (scope === "contact") {
        await assignContactLayoutTemplate(getExecutor(), {
          contactId: targetContactId,
          templateUid: activeTemplate.uid,
          now,
        });
      } else {
        // Remove the explicit contact template only after the user makes this
        // distinct inherited choice; collapse clearing stays in the DAO.
        await assignContactLayoutTemplate(getExecutor(), {
          contactId,
          templateUid: null,
          now,
        });
      }
    });
  };

  const deleteUsage = deleteUid ? state.usage[deleteUid] : undefined;
  const deleteTemplate = deleteUid
    ? templates.find((template) => template.uid === deleteUid)
    : null;
  // 38.11-13: the current layout in plain words, with the template's name
  // when it resolved from one (never the raw source id).
  const currentTemplateUid = effectiveLayoutTemplateUid(
    effectiveLayoutSource,
    presentation,
  );
  const currentTemplateName =
    currentTemplateUid === null
      ? null
      : (templates.find((template) => template.uid === currentTemplateUid)
          ?.name ?? null);
  const currentLayout = describeCurrentLayout(
    effectiveLayoutSource,
    currentTemplateName,
  );
  const assignmentDescription = describeTemplateAssignment({
    source: effectiveLayoutSource,
    templateName: currentTemplateName,
  });

  return (
    <>
      <Sheet visible={visible} onRequestClose={closeOrBack} variant="expanded">
        <View style={styles.root} accessibilityViewIsModal>
          <View style={styles.heading}>
            {/* The 38.9 header Back (38.11 D-43): icon-only chevron, 44dp. */}
            <Button
              role="iconOnly"
              icon="back"
              accessibilityLabel="Back"
              onPress={closeOrBack}
            />
            <AppText role="heading" style={styles.headingTitle}>
              Profile layout templates
            </AppText>
          </View>
          {state.error ? (
            <AppText
              accessibilityLiveRegion="polite"
              style={{ color: colors.danger }}
            >
              {state.error}
            </AppText>
          ) : null}
          {activePage.kind === "list" ? (
            <ScrollView contentContainerStyle={styles.content}>
              <AppText role="body">
                {contactName} currently uses {currentLayout}. Templates change
                every Profile assigned to them.
              </AppText>
              {currentLayoutForNewTemplate ? (
                <Button
                  role="secondary"
                  label="Save current layout as template"
                  onPress={() => {
                    setAssignCreatedTemplate(true);
                    setState(
                      setTemplateDraft(state, {
                        name: `${contactName}'s layout`,
                        layout: currentLayoutForNewTemplate,
                      }),
                    );
                  }}
                />
              ) : null}
              <Button
                role="primary"
                label="Create layout template"
                onPress={() => {
                  setAssignCreatedTemplate(false);
                  setState(
                    openTemplateManagerPage(
                      setTemplateDraft(state, {
                        name: "",
                        layout: presentation.factoryLayout,
                      }),
                      { kind: "create" },
                    ),
                  );
                }}
              />
              {listLoad.loading ? <AppText>Loading templates…</AppText> : null}
              {listLoad.error ? (
                <>
                  <AppText style={{ color: colors.danger }}>
                    {listLoad.error}
                  </AppText>
                  <Button
                    role="secondary"
                    label="Retry"
                    onPress={() => void loadList()}
                  />
                </>
              ) : null}
              {!listLoad.loading &&
              !listLoad.error &&
              templates.length === 0 ? (
                <AppText role="body">
                  No reusable templates yet. The default layout is still
                  available.
                </AppText>
              ) : null}
              {templates.map((template) => (
                <GlassSurface
                  key={template.uid}
                  density="dense"
                  style={styles.templateRow}
                >
                  <AppText role="label">{template.name}</AppText>
                  <AppText role="caption">
                    {usageText(state.usage[template.uid])}
                  </AppText>
                  <View style={styles.actions}>
                    <Button
                      role="tertiary"
                      label="Preview"
                      onPress={() =>
                        setState(
                          openTemplateManagerPage(state, {
                            kind: "preview",
                            templateUid: template.uid,
                          }),
                        )
                      }
                    />
                    <Button
                      role="tertiary"
                      label="Assign"
                      onPress={() =>
                        setState(
                          openTemplateManagerPage(state, {
                            kind: "assignment",
                            templateUid: template.uid,
                          }),
                        )
                      }
                    />
                    <Button
                      role="tertiary"
                      label="Usage"
                      onPress={() => void openUsage(template.uid)}
                    />
                    <Button
                      role="tertiary"
                      label="Rename"
                      onPress={() =>
                        setState(
                          openTemplateManagerPage(
                            setTemplateDraft(state, {
                              name: template.name,
                              layout: templateLayout(template),
                            }),
                            { kind: "edit", templateUid: template.uid },
                          ),
                        )
                      }
                    />
                    <Button
                      role="tertiary"
                      label="Delete"
                      onPress={() => void requestDelete(template.uid)}
                    />
                  </View>
                </GlassSurface>
              ))}
            </ScrollView>
          ) : null}
          {activePage.kind === "create" ? (
            <TemplateNameForm
              title="Create layout template"
              draft={state.draft}
              onChange={(name) =>
                state.draft &&
                setState(setTemplateDraft(state, { ...state.draft, name }))
              }
              onSave={saveNewTemplate}
            />
          ) : null}
          {activePage.kind === "preview" && activeTemplate ? (
            <TemplatePreview template={activeTemplate} />
          ) : null}
          {activePage.kind === "usage" && activeTemplate ? (
            <View style={styles.content}>
              <AppText role="heading">{activeTemplate.name} usage</AppText>
              <AppText role="body">
                {usageText(state.usage[activeTemplate.uid])}
              </AppText>
              <AppText role="caption">
                Usage is refreshed before deletion. Removing this template makes
                each assignment fall back to its next inherited source.
              </AppText>
            </View>
          ) : null}
          {activePage.kind === "edit" && activeTemplate ? (
            <View style={styles.content}>
              <AppText role="heading">{activeTemplate.name}</AppText>
              <Button
                role="primary"
                label="Edit template layout"
                onPress={() =>
                  setEditingLayout({
                    uid: activeTemplate.uid,
                    name: activeTemplate.name,
                    // Completed at read time like the Profile's own editor;
                    // written only by an explicit Save (38.11-13).
                    layout: templateLayoutForDisplay(activeTemplate.layoutJson),
                  })
                }
              />
              <Button
                role="secondary"
                label="Rename template"
                onPress={() =>
                  setState(
                    setTemplateDraft(state, {
                      name: activeTemplate.name,
                      layout: templateLayout(activeTemplate),
                    }),
                  )
                }
              />
              {state.draft ? (
                <TemplateNameForm
                  title="Rename layout template"
                  draft={state.draft}
                  onChange={(name) =>
                    setState(
                      setTemplateDraft(state, {
                        name,
                        layout:
                          state.draft?.layout ?? templateLayout(activeTemplate),
                      }),
                    )
                  }
                  onSave={() => {
                    const draft = state.draft;
                    if (!draft) return;
                    void (async () => {
                      const saved = await runTemplateOperation(
                        activeTemplate.uid,
                        async () => {
                          await updateProfileLayoutTemplate(getExecutor(), {
                            uid: activeTemplate.uid,
                            name: draft.name,
                            layout: draft.layout,
                            now: localDateTime(),
                          });
                        },
                      );
                      if (saved)
                        setState((current) => clearTemplateDraft(current));
                    })();
                  }}
                />
              ) : null}
            </View>
          ) : null}
          {activePage.kind === "assignment" && activeTemplate ? (
            <View style={styles.content}>
              <AppText role="heading">Assign {activeTemplate.name}</AppText>
              <AppText role="body">{assignmentDescription.text}</AppText>
              <AppText role="caption">
                {describeAssignmentKind(assignmentDescription.kind)}
              </AppText>
              <Button
                role="secondary"
                label="Set as global default"
                onPress={() => assign("global")}
              />
              <AppText role="label">Set for this category</AppText>
              {categories.length === 0 ? (
                <AppText role="body">No categories available</AppText>
              ) : (
                <Button
                  role="tertiary"
                  label="Choose category"
                  onPress={() => setCategoryPickerVisible(true)}
                />
              )}
              <AppText role="label">This Profile</AppText>
              <Button
                role="primary"
                label={`Use for ${contactName}`}
                onPress={() => assign("contact")}
              />
              <Button
                role="secondary"
                label={`Use inherited layout for ${contactName}`}
                onPress={() => assign("inherit")}
              />
              <AppText role="label">Individual contact</AppText>
              <Button
                role="secondary"
                label="Choose individual contact"
                onPress={() => setContactPickerVisible(true)}
              />
              <AppText role="caption">
                Choose any active local contact to give it this template as its
                own layout. Applying or removing a contact selection clears only
                that contact's collapsed-section choices once it's saved.
              </AppText>
            </View>
          ) : null}
        </View>
      </Sheet>
      <ContactPicker
        visible={contactPickerVisible}
        allowArchivedSearch={false}
        onDismiss={() => setContactPickerVisible(false)}
        onSelect={(selectedContactId) => {
          setContactPickerVisible(false);
          assign("contact", selectedContactId);
        }}
      />
      <CategoryChoiceSheet
        visible={categoryPickerVisible}
        categories={categories}
        selectedId={null}
        allowUncategorized={false}
        title="Assign layout to category"
        onRequestClose={() => setCategoryPickerVisible(false)}
        onSelect={(categoryId) => {
          if (categoryId !== null) assign("category", undefined, categoryId);
        }}
      />
      <ConfirmDialog
        visible={deleteTemplate !== null}
        onRequestClose={() => setDeleteUid(null)}
        title="Delete layout template?"
        message={`${deleteTemplate?.name ?? "This template"} has ${deleteUsage?.total ?? 0} assignment${deleteUsage?.total === 1 ? "" : "s"}. Profiles using it will fall back to their Category or default layout. Contact-specific freeform layouts will not change.`}
        confirmLabel="Delete template"
        destructive
        onConfirm={() => {
          if (!deleteUid) return;
          const uid = deleteUid;
          setDeleteUid(null);
          void runTemplateOperation(uid, async () => {
            await deleteProfileLayoutTemplate(
              getExecutor(),
              uid,
              localDateTime(),
            );
          });
        }}
      />
      {editingLayout ? (
        <ProfileLayoutEditor
          visible
          // D-89: a template's layout opens straight in the editor, never on
          // the contact-specific Profile Layout first page.
          startInEditor
          contactId={contactId}
          contactName={contactName}
          currentLayout={currentLayout}
          layout={editingLayout.layout}
          onRequestClose={() => setEditingLayout(null)}
          onSaveDraft={async (layout) => {
            if (!editingLayout.uid) return;
            await updateProfileLayoutTemplate(getExecutor(), {
              uid: editingLayout.uid,
              name: editingLayout.name,
              layout,
              now: localDateTime(),
            });
            await refresh();
            onCommitted?.();
          }}
        />
      ) : null}
    </>
  );
}

function TemplateNameForm({
  title,
  draft,
  onChange,
  onSave,
}: {
  title: string;
  draft: TemplateManagerState["draft"];
  onChange: (name: string) => void;
  onSave: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.content}>
      <AppText role="heading">{title}</AppText>
      <TextInput
        accessibilityLabel="Template name"
        value={draft?.name ?? ""}
        onChangeText={onChange}
        style={[
          styles.input,
          {
            color: colors.textPrimary,
            borderColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      />
      <Button role="primary" label="Save template" onPress={onSave} />
    </View>
  );
}

function TemplatePreview({ template }: { template: ProfileLayoutTemplateRow }) {
  // 38.11-08 deferred item: a pre-38.11 template previews with its Birthday
  // tile (read-time completion, nothing written back). Review IN-08: modules
  // read by label, never raw id or size (`templatePreviewLines`).
  const lines = templatePreviewLines(
    templateLayoutForDisplay(template.layoutJson),
  );
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <AppText role="heading">Preview {template.name}</AppText>
      <AppText role="caption">
        Fixed Hero · {lines.topLevel.join(" · ")}
      </AppText>
      <AppText role="label">Relationship Overview</AppText>
      {lines.overview.map((label) => (
        <AppText key={label}>{label}</AppText>
      ))}
      <AppText role="label">Things to Remember</AppText>
      {lines.thingsToRemember.map((label) => (
        <AppText key={label}>{label}</AppText>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: SPACING.sm },
  heading: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.sm,
  },
  headingTitle: { flex: 1 },
  content: { gap: SPACING.sm, paddingBottom: SPACING.xl },
  templateRow: { gap: SPACING.xs, padding: SPACING.sm },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: RADII.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
});
