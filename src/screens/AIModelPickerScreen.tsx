// biome-ignore-all lint/a11y/useValidAriaRole: `role` is Orbit's visual/typography domain prop.
import { Directory, File, Paths } from "expo-file-system";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import {
  loadCachedCatalog,
  refreshModelCatalog,
} from "@/ai/model-catalog-cache";
import { createFileCatalogStorage } from "@/ai/model-catalog-storage";
import {
  curatedModelsFor,
  curatedOpenRouterModels,
  modelsFor,
  resolveActiveCatalog,
} from "@/ai/model-registry";
import {
  loadCachedOpenRouterCatalog,
  type OpenRouterCatalog,
  type OpenRouterCatalogStorage,
  refreshOpenRouterCatalog,
  refreshOpenRouterCatalogIfStale,
} from "@/ai/openrouter-catalog";
import { AppText, Button, GlassSurface } from "@/components/ui";
import {
  activateAiConnection,
  setRememberedModel,
} from "@/db/ai-connections-dao";
import { getExecutor, localDateTime } from "@/db/database";
import type { AiCloudProviderId } from "@/services/ai-types";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { Logger } from "@/utils/logger";
import {
  directCards,
  filterModelCards,
  openRouterCards,
} from "./ai-model-picker-logic";

const LOG_SCOPE = "ai-model-picker";
const EMPTY_COPY =
  "No models available. Connect and refresh to load the catalog.";

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

export interface AIModelPickerScreenProps {
  lane: AiCloudProviderId;
  onBack: () => void;
  onSelected?: (model: string) => void;
}

export function AIModelPickerScreen({
  lane,
  onBack,
  onSelected,
}: AIModelPickerScreenProps) {
  const { colors } = useTheme();
  const [openRouterCatalog, setOpenRouterCatalog] =
    useState<OpenRouterCatalog | null>(null);
  const [directCatalog, setDirectCatalog] = useState(() =>
    resolveActiveCatalog(null),
  );
  const [query, setQuery] = useState("");
  const [browseAll, setBrowseAll] = useState(false);
  const [manualModel, setManualModel] = useState("");
  const [moreInfo, setMoreInfo] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const openRouterStorage = useMemo(createOpenRouterStorage, []);
  const directStorage = useMemo(createFileCatalogStorage, []);

  const load = useCallback(async () => {
    if (lane === "openrouter") {
      const cached = await loadCachedOpenRouterCatalog(openRouterStorage);
      setOpenRouterCatalog(cached);
      void refreshOpenRouterCatalogIfStale({
        fetchImpl: fetch,
        storage: openRouterStorage,
      })
        .then(({ catalog }) => setOpenRouterCatalog(catalog))
        .catch(() =>
          setMessage("Couldn't refresh models — using the saved list."),
        );
      return;
    }
    if (lane !== "custom") {
      setDirectCatalog(
        resolveActiveCatalog(await loadCachedCatalog(directStorage)),
      );
    }
  }, [directStorage, lane, openRouterStorage]);

  useEffect(() => {
    void load().catch((caught) => {
      Logger.error(LOG_SCOPE, "failed to load model catalog", caught);
      setMessage("Couldn't load models.");
    });
  }, [load]);

  const cards = useMemo(() => {
    if (lane === "openrouter") {
      const models = openRouterCatalog?.models ?? [];
      return openRouterCards(models, curatedOpenRouterModels(models));
    }
    if (lane === "custom") return [];
    const all = modelsFor(directCatalog, lane, "all");
    return directCards(all, curatedModelsFor(directCatalog, lane));
  }, [directCatalog, lane, openRouterCatalog]);
  const visibleCards = useMemo(() => {
    const source = browseAll
      ? cards
      : cards.filter((card) => card.recommendation !== null);
    return filterModelCards(source, query);
  }, [browseAll, cards, query]);

  async function choose(model: string) {
    const trimmed = model.trim();
    if (trimmed === "") return;
    try {
      await setRememberedModel(getExecutor(), lane, trimmed, localDateTime());
      await activateAiConnection(getExecutor(), lane, localDateTime());
      onSelected?.(trimmed);
      onBack();
    } catch (caught) {
      Logger.error(LOG_SCOPE, "failed to save model selection", caught);
      setMessage("Couldn't save that model.");
    }
  }

  async function refresh() {
    if (refreshing || lane === "custom") return;
    setRefreshing(true);
    setMessage(null);
    try {
      if (lane === "openrouter") {
        setOpenRouterCatalog(
          await refreshOpenRouterCatalog({
            fetchImpl: fetch,
            storage: openRouterStorage,
          }),
        );
      } else {
        setDirectCatalog(
          await refreshModelCatalog({
            fetchImpl: fetch,
            storage: directStorage,
          }),
        );
      }
    } catch (caught) {
      Logger.error(LOG_SCOPE, "model refresh failed", caught);
      setMessage("Couldn't refresh models — using the saved list.");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Button role="tertiary" label="Back" onPress={onBack} />
        <AppText accessibilityRole="header" role="display">
          Choose a model
        </AppText>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {lane !== "custom" ? (
          <>
            <View style={styles.toolbar}>
              <Button
                role="tertiary"
                label={browseAll ? "Show recommendations" : "Browse all models"}
                onPress={() => setBrowseAll((value) => !value)}
              />
              <Button
                role="tertiary"
                label={refreshing ? "Refreshing models…" : "Refresh Models"}
                disabled={refreshing}
                onPress={() => void refresh()}
              />
            </View>
            {browseAll ? (
              <TextInput
                accessibilityLabel="Search models"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Search models"
                placeholderTextColor={colors.textSecondary}
                value={query}
                onChangeText={setQuery}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                  },
                ]}
              />
            ) : null}
            {lane === "openrouter" && openRouterCatalog ? (
              <AppText role="caption" style={{ color: colors.textSecondary }}>
                Updated {openRouterCatalog.updatedLocalDate}
              </AppText>
            ) : null}
          </>
        ) : null}

        {visibleCards.length === 0 ? (
          lane === "custom" ? null : (
            <GlassSurface density="dense" style={styles.card}>
              <AppText role="body">{EMPTY_COPY}</AppText>
            </GlassSurface>
          )
        ) : (
          visibleCards.map((card) => (
            <GlassSurface key={card.id} density="dense" style={styles.card}>
              <View style={styles.modelCopy}>
                <AppText role="label">{card.name}</AppText>
                <AppText role="caption" style={{ color: colors.textSecondary }}>
                  {card.provider}
                </AppText>
                {card.recommendation ? (
                  <AppText role="caption" style={{ color: colors.accentText }}>
                    {card.recommendation}
                  </AppText>
                ) : null}
                {lane === "openrouter" ? (
                  card.pricing ? (
                    <AppText role="caption">{card.pricing}</AppText>
                  ) : (
                    <AppText
                      role="caption"
                      style={{ color: colors.textSecondary }}
                    >
                      Pricing unavailable
                    </AppText>
                  )
                ) : (
                  <AppText
                    role="caption"
                    style={{ color: colors.textSecondary }}
                  >
                    Cost estimate unavailable for this connection.
                  </AppText>
                )}
                {moreInfo === card.id && card.context ? (
                  <AppText
                    role="caption"
                    style={{ color: colors.textSecondary }}
                  >
                    {card.context}
                  </AppText>
                ) : null}
              </View>
              <View style={styles.toolbar}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    setMoreInfo(moreInfo === card.id ? null : card.id)
                  }
                >
                  <AppText role="caption" style={{ color: colors.accentText }}>
                    More Info
                  </AppText>
                </Pressable>
                <Button
                  role="secondary"
                  label="Choose this model"
                  onPress={() => void choose(card.id)}
                />
              </View>
            </GlassSurface>
          ))
        )}

        <GlassSurface density="dense" style={styles.card}>
          <AppText role="heading">Manual model id</AppText>
          <TextInput
            accessibilityLabel="Manual model id"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Enter model id"
            placeholderTextColor={colors.textSecondary}
            value={manualModel}
            onChangeText={setManualModel}
            style={[
              styles.input,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.textPrimary,
              },
            ]}
          />
          {lane !== "openrouter" ? (
            <AppText role="caption" style={{ color: colors.textSecondary }}>
              Cost estimate unavailable for this connection.
            </AppText>
          ) : null}
          <Button
            role="secondary"
            label="Choose this model"
            disabled={manualModel.trim() === ""}
            onPress={() => void choose(manualModel)}
          />
        </GlassSurface>
        {message ? (
          <AppText role="caption" style={{ color: colors.danger }}>
            {message}
          </AppText>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: SPACING.md, padding: SPACING.base },
  content: { gap: SPACING.md, padding: SPACING.base },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.md,
    padding: SPACING.base,
  },
  input: {
    borderRadius: RADII.md,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
    paddingHorizontal: SPACING.md,
  },
  modelCopy: { flex: 1, gap: SPACING.xs },
  root: { flex: 1 },
  toolbar: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    justifyContent: "space-between",
  },
});
