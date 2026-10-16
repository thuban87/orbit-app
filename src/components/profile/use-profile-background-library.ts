import { useCallback, useState } from "react";
import { getAppSettings } from "@/db/app-settings-dao";
import { listCategories } from "@/db/contact-read";
import { getExecutor, localDateTime } from "@/db/database";
import {
  assignCategoryProfilePresentation,
  assignGlobalProfileBackgroundTemplate,
  deleteProfileBackgroundTemplate,
} from "@/db/profile-presentation-dao";
import {
  listProfileBackgroundTemplates,
  type ProfileBackgroundTemplateRow,
  readCategoryProfilePresentation,
} from "@/db/profile-presentation-read";
import { deleteBackgroundTemplateAndRefresh } from "@/profile/background-manager-model";
import { deleteBackgroundDerivative } from "@/services/photos/background-storage";
import { confirm } from "@/stores/confirm-store";
import { useShellRefresh } from "@/stores/shell-refresh-store";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "profile-background-library";

export type BackgroundLibraryCategory = {
  id: number;
  uid?: string;
  name: string;
};

export interface UseProfileBackgroundLibraryOptions {
  /** Refreshes on a shell refresh only while the host is showing (the sheet is open, the page is mounted). */
  active: boolean;
  /** Fired after a durable write (delete), so the host can reload what it shows. */
  onCommitted?: () => void;
  /**
   * Also read the current global background and each Category's background
   * (the Settings Profile Backgrounds page, 38.11 D-58.1). The Profile sheet
   * leaves it off and loads exactly what it did before.
   */
  includeAssignments?: boolean;
}

/**
 * The shared background library operations (38.11 D-58.1; RESEARCH section 5
 * R2): one load, one delete (the themed destructive confirm, the transactional
 * delete, then derivative cleanup — ADR-112), and the global/category
 * assignment writes. Used by the Profile's background sheet and by the Settings
 * Profile Backgrounds page so neither duplicates the cleanup.
 */
export function useProfileBackgroundLibrary({
  active,
  onCommitted,
  includeAssignments = false,
}: UseProfileBackgroundLibraryOptions) {
  const [templates, setTemplates] = useState<ProfileBackgroundTemplateRow[]>(
    [],
  );
  const [categories, setCategories] = useState<BackgroundLibraryCategory[]>([]);
  const [globalTemplateUid, setGlobalTemplateUid] = useState<string | null>(
    null,
  );
  const [categoryTemplateUids, setCategoryTemplateUids] = useState<
    ReadonlyMap<number, string | null>
  >(new Map());
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const [nextTemplates, nextCategories] = await Promise.all([
        listProfileBackgroundTemplates(getExecutor()),
        listCategories(getExecutor()),
      ]);
      if (includeAssignments) {
        const [settings, perCategory] = await Promise.all([
          getAppSettings(getExecutor()),
          Promise.all(
            nextCategories.map(
              async (category) =>
                [
                  category.id,
                  (
                    await readCategoryProfilePresentation(
                      getExecutor(),
                      category.id,
                    )
                  ).backgroundTemplateUid,
                ] as const,
            ),
          ),
        ]);
        setGlobalTemplateUid(settings.profileBackgroundTemplateUid);
        setCategoryTemplateUids(new Map(perCategory));
      }
      setTemplates(nextTemplates);
      setCategories(nextCategories);
    } catch (error) {
      Logger.error(LOG_SCOPE, "failed to load background templates", error);
      setListError("Couldn't load background templates. Try again.");
    } finally {
      setListLoading(false);
    }
  }, [includeAssignments]);
  useShellRefresh(() => {
    if (active) void refresh();
  });

  /**
   * Asks with the themed destructive confirm, then deletes the template row
   * before its now-unreferenced derivative (ADR-112) and reloads. Resolves
   * true only when the template was deleted.
   */
  const deleteTemplate = useCallback(
    async (template: ProfileBackgroundTemplateRow): Promise<boolean> => {
      const ok = await confirm({
        title: "Delete background template?",
        message:
          "Profiles using it will fall back to their Category or default background. Contact information will not change.",
        confirmLabel: "Delete template",
        destructive: true,
      });
      if (!ok) return false;
      try {
        await deleteBackgroundTemplateAndRefresh({
          removeTemplate: () =>
            deleteProfileBackgroundTemplate(
              getExecutor(),
              template.uid,
              localDateTime(),
            ),
          removeDerivative: deleteBackgroundDerivative,
          refresh,
          onCommitted,
        });
        return true;
      } catch (error) {
        Logger.error(LOG_SCOPE, "failed to delete background template", error);
        setListError("Couldn't delete that background. Try again.");
        return false;
      }
    },
    [onCommitted, refresh],
  );

  /** Sets (a uid) or clears (null) the global profile background, then reloads. Rejects on failure. */
  const assignGlobal = useCallback(
    async (templateUid: string | null) => {
      await assignGlobalProfileBackgroundTemplate(getExecutor(), {
        templateUid,
        now: localDateTime(),
      });
      await refresh();
    },
    [refresh],
  );

  /**
   * Sets (a uid) or clears (null) one Category's background, keeping that
   * Category's layout template (the sibling axis is never erased), then
   * reloads. Rejects on failure.
   */
  const assignCategory = useCallback(
    async (categoryId: number, templateUid: string | null) => {
      const current = await readCategoryProfilePresentation(
        getExecutor(),
        categoryId,
      );
      await assignCategoryProfilePresentation(getExecutor(), {
        categoryId,
        layoutTemplateUid: current.layoutTemplateUid,
        backgroundTemplateUid: templateUid,
        now: localDateTime(),
      });
      await refresh();
    },
    [refresh],
  );

  return {
    templates,
    categories,
    globalTemplateUid,
    categoryTemplateUids,
    listLoading,
    listError,
    refresh,
    deleteTemplate,
    assignGlobal,
    assignCategory,
  };
}

export type ProfileBackgroundLibrary = ReturnType<
  typeof useProfileBackgroundLibrary
>;
