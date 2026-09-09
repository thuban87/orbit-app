// biome-ignore-all lint/a11y/useValidAriaRole: AppText/Button semantic roles are domain props.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, ScrollView, StyleSheet, TextInput, View } from "react-native";
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
  assignGlobalProfilePresentation,
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
import { parseAndCanonicalizeProfileLayout } from "@/profile/presentation-schema";
import {
  activeTemplateManagerPage,
  beginTemplateOperation,
  clearTemplateDraft,
  createTemplateManagerState,
  describeTemplateAssignment,
  managerBackIntent,
  openTemplateManagerPage,
  popTemplateManagerPage,
  retainTemplateFailure,
  setTemplateDraft,
  setTemplateUsage,
  settleTemplateOperation,
  type TemplateManagerState,
} from "@/profile/template-manager-model";
import type {
  ProfileLayoutDocument,
  ProfilePresentationInputs,
  ProfilePresentationSource,
} from "@/profile/types";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { ProfileLayoutEditor } from "./ProfileLayoutEditor";

export interface ProfileTemplateManagerProps {
  visible: boolean;
  contactId: number;
  contactName: string;
  /** Current resolved Layout source, named for the user rather than raw IDs. */
  effectiveSource: string;
  /** Resolved source remains explicit so inherited and override rows never merge. */
  effectiveLayoutSource: Extract<
    ProfilePresentationSource,
    "contact-template" | "contact-freeform" | "category" | "global" | "factory"
  >;
  /** The contact's current freeform layout, if any, for Save Current Layout. */
  freeformLayout: ProfileLayoutDocument | null;
  /** Current hierarchy inputs let layout writes retain the independent background axis. */
  presentation: ProfilePresentationInputs;
  onRequestClose: () => void;
  /** Called only after a durable create/edit/assignment/delete succeeds. */
  onCommitted?: () => void;
}

type Category = { id: number; name: string };

function usageText(usage: ProfileTemplateUsage | undefined): string {
  if (!usage) return "Checking usage…";
  return `${usage.total} assignment${usage.total === 1 ? "" : "s"} · ${usage.global} global · ${usage.categories} Category · ${usage.contacts} contact`;
}

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
  effectiveSource,
  effectiveLayoutSource,
  freeformLayout,
  presentation,
  onRequestClose,
  onCommitted,
}: ProfileTemplateManagerProps) {
  const { colors } = useTheme();
  const [state, setState] = useState<TemplateManagerState>(
    createTemplateManagerState,
  );
  const [templates, setTemplates] = useState<ProfileLayoutTemplateRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingLayout, setEditingLayout] = useState<{
    uid: string | null;
    name: string;
    layout: ProfileLayoutDocument;
  } | null>(null);
  const [deleteUid, setDeleteUid] = useState<string | null>(null);
  const [assignCreatedTemplate, setAssignCreatedTemplate] = useState(false);
  const pendingTemplateUids = useRef(new Set<string>());

  const activePage = activeTemplateManagerPage(state);
  const activeTemplate = useMemo(
    () =>
      isTemplatePage(activePage)
        ? (templates.find((row) => row.uid === activePage.templateUid) ?? null)
        : null,
    [activePage, templates],
  );

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

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    void refresh()
      .catch(() =>
        setState((current) => ({
          ...current,
          error: "Couldn't load layout templates. Try again.",
        })),
      )
      .finally(() => setLoading(false));
  }, [refresh, visible]);

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
    Alert.alert(
      "Discard changes?",
      "Your template changes have not been saved.",
      [
        { text: "Keep editing", style: "cancel" },
        {
          text: "Discard changes",
          style: "destructive",
          onPress: () => {
            setState(clearTemplateDraft(state));
            onRequestClose();
          },
        },
      ],
    );
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
    categoryId?: number,
  ) => {
    if (!activeTemplate) return;
    void runTemplateOperation(activeTemplate.uid, async () => {
      const now = localDateTime();
      if (scope === "global") {
        await assignGlobalProfilePresentation(getExecutor(), {
          layoutTemplateUid: activeTemplate.uid,
          backgroundTemplateUid: presentation.global.backgroundTemplateUid,
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
          contactId,
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
  const assignmentDescription = describeTemplateAssignment({
    source: effectiveLayoutSource,
    templateName: effectiveSource,
  });

  return (
    <>
      <Sheet visible={visible} onRequestClose={closeOrBack} variant="expanded">
        <View style={styles.root} accessibilityViewIsModal>
          <View style={styles.heading}>
            <AppText role="heading">Profile layout templates</AppText>
            <Button role="secondary" label="Back" onPress={closeOrBack} />
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
                {contactName} currently uses {effectiveSource}. Templates change
                every Profile assigned to them.
              </AppText>
              {freeformLayout ? (
                <Button
                  role="secondary"
                  label="Save current layout as template"
                  onPress={() => {
                    setAssignCreatedTemplate(true);
                    setState(
                      setTemplateDraft(state, {
                        name: `${contactName}'s layout`,
                        layout: freeformLayout,
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
              {loading ? <AppText>Loading templates…</AppText> : null}
              {!loading && templates.length === 0 ? (
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
                    layout: templateLayout(activeTemplate),
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
                This contact is currently {assignmentDescription.kind}.
              </AppText>
              <Button
                role="secondary"
                label="Set as global default"
                onPress={() => assign("global")}
              />
              <AppText role="label">Category override</AppText>
              {categories.map((category) => (
                <Button
                  key={category.id}
                  role="tertiary"
                  label={`Assign to ${category.name}`}
                  onPress={() => assign("category", category.id)}
                />
              ))}
              <AppText role="label">Contact</AppText>
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
              <AppText role="caption">
                Applying or removing a contact selection clears only that
                contact's collapsed-section overrides after the write commits.
              </AppText>
            </View>
          ) : null}
        </View>
      </Sheet>
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
          contactId={contactId}
          contactName={contactName}
          effectiveSource={editingLayout.name}
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
  const layout = templateLayout(template);
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <AppText role="heading">Preview {template.name}</AppText>
      <AppText role="caption">
        Fixed Hero ·{" "}
        {layout.topLevel
          .filter((item) => item.visible)
          .map((item) => item.id)
          .join(" · ")}
      </AppText>
      <AppText role="label">Relationship Overview</AppText>
      {layout.overview
        .filter((item) => item.visible)
        .map((item) => (
          <AppText key={item.id}>
            {item.id} · {item.size}
          </AppText>
        ))}
      <AppText role="label">Things to Remember</AppText>
      {layout.thingsToRemember
        .filter((item) => item.visible)
        .map((item) => (
          <AppText key={item.id}>{item.id}</AppText>
        ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: SPACING.sm },
  heading: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
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
