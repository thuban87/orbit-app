import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  choosePrimary,
  type MethodGroups,
} from "@/components/contact-methods-editor-model";
import {
  FieldChoiceGroup,
  type FieldChoiceOption,
} from "@/components/FieldChoiceGroup";
import { type KEEP_ORBIT_PHOTO, PhotoChoice } from "@/components/PhotoChoice";
import { ShellAppBar } from "@/components/ShellAppBar";
import { getExecutor } from "@/db/database";
import {
  type MergeConflictData,
  readMergeConflictData,
} from "@/db/merge-conflicts-read";
import type { MergeResolutions } from "@/db/merge-dao";
import type { ContactMethodType } from "@/logic/contact-method-normalization";
import { DEFAULT_FLOW_HOST } from "@/navigation/flow-host";
import type { RootStackScreenProps } from "@/navigation/types";
import {
  customConflictDisplayValues,
  customPhotoConflictChoice,
  hasResolvedMergeConflicts,
  type MergeConflictChoice,
} from "@/screens/merge-conflict-logic";
import { useTheme } from "@/theme";
import { formatStoredBirthdayForDisplay } from "@/utils/dates";

function meaningful(value: string | null): boolean {
  return value != null && value.trim().length > 0;
}

function differs(
  a: string | number | null,
  b: string | number | null,
): boolean {
  return (
    a !== b &&
    !(typeof a === "string" && typeof b === "string" && a.trim() === b.trim())
  );
}

function provenance(name: string): string {
  return `From ${name}`;
}

/** Resolve scalar and primary-method disputes before the destructive confirmation. */
export function MergeConflictsScreen({
  navigation,
  route,
}: RootStackScreenProps<"MergeConflicts">) {
  const { colors } = useTheme();
  const { survivorId, absorbedId } = route.params;
  // 38.12 D-110: the flow host passes through to the merge summary, which ends
  // the merge where it was started.
  const host = route.params.host ?? DEFAULT_FLOW_HOST;
  const [data, setData] = useState<MergeConflictData | null>(null);
  const [failed, setFailed] = useState(false);
  const [scalarChoices, setScalarChoices] = useState<
    Record<string, MergeConflictChoice>
  >({});
  const [customFieldChoices, setCustomFieldChoices] = useState<
    Record<number, MergeConflictChoice>
  >({});
  const [primaryChoices, setPrimaryChoices] = useState<
    Partial<Record<ContactMethodType, MergeConflictChoice>>
  >({});
  const [photoChoice, setPhotoChoice] = useState<
    "survivor" | "absorbed" | typeof KEEP_ORBIT_PHOTO | null
  >(null);

  // Read through the merge conflicts DAO (38.12 D-44; CLAUDE.md DAO rule).
  useEffect(() => {
    let cancelled = false;
    void readMergeConflictData(getExecutor(), survivorId, absorbedId)
      .then((loaded) => {
        if (!cancelled) setData(loaded);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [absorbedId, survivorId]);

  const scalarConflicts = useMemo(() => {
    if (!data)
      return [] as Array<{
        key: "name" | "birthday" | "categoryId";
        label: string;
        survivor: string;
        absorbed: string;
      }>;
    const values = [
      {
        key: "name" as const,
        label: "Name",
        survivor: data.survivor.name,
        absorbed: data.absorbed.name,
      },
      {
        key: "birthday" as const,
        label: "Birthday",
        survivor: data.survivor.birthday,
        absorbed: data.absorbed.birthday,
      },
      {
        key: "categoryId" as const,
        label: "Category",
        survivor: data.survivor.category_label,
        absorbed: data.absorbed.category_label,
      },
    ];
    return values.filter(
      (value) =>
        meaningful(value.survivor) &&
        meaningful(value.absorbed) &&
        differs(value.survivor, value.absorbed),
    ) as Array<{
      key: "name" | "birthday" | "categoryId";
      label: string;
      survivor: string;
      absorbed: string;
    }>;
  }, [data]);
  const photoConflict =
    data != null &&
    data.survivor.photo != null &&
    data.absorbed.photo != null &&
    data.survivor.photo !== data.absorbed.photo;
  const primaryTypes = data
    ? (Object.keys(data.primaryByType) as ContactMethodType[])
    : [];
  const ready =
    data != null &&
    hasResolvedMergeConflicts({
      scalarKeys: scalarConflicts.map((conflict) => conflict.key),
      customFieldIds:
        data?.customFields.map((field) => field.field_def_id) ?? [],
      primaryTypes,
      hasPhotoConflict: photoConflict,
      scalarChoices,
      customFieldChoices,
      primaryChoices,
      photoChoice,
    });

  const continueToSummary = () => {
    if (!data || !ready) return;
    const resolutions: MergeResolutions = {
      ...(Object.keys(scalarChoices).length ? { scalars: scalarChoices } : {}),
      ...(Object.keys(customFieldChoices).length
        ? { customFields: customFieldChoices }
        : {}),
      ...(Object.keys(primaryChoices).length
        ? { primaryMethod: primaryChoices }
        : {}),
      ...(photoChoice === "absorbed" && data.absorbed.photo
        ? { photo: { choice: "absorbed" } }
        : {}),
    };
    navigation.navigate("MergeImpactSummary", {
      survivorId,
      absorbedId,
      resolutions,
      host,
    });
  };

  // House header with Back (38.9 D-16, D-44); the failed and loading states
  // render it too, so every state has the same way out.
  const header = (
    <ShellAppBar variant="child" title="Resolve merge conflicts" />
  );

  if (failed)
    return (
      <View style={styles.screen}>
        {header}
        <View style={styles.root}>
          <Text style={{ color: colors.danger }}>
            Couldn&apos;t load merge conflicts. Nothing was changed.
          </Text>
        </View>
      </View>
    );
  if (!data)
    return (
      <View style={styles.screen}>
        {header}
        <View style={styles.root}>
          <Text style={{ color: colors.textSecondary }}>
            Loading merge conflicts…
          </Text>
        </View>
      </View>
    );

  const choiceOptions = (
    survivor: string,
    absorbed: string,
  ): FieldChoiceOption<MergeConflictChoice>[] => [
    {
      id: "survivor",
      value: survivor,
      provenance: provenance(data.survivor.name),
    },
    {
      id: "absorbed",
      value: absorbed,
      provenance: provenance(data.absorbed.name),
    },
  ];

  // Render only (38.9 D-70, D-23; review C6-L4): a birthday choice shows its
  // display form. `scalarConflicts` keeps the raw values for `differs()`, and
  // the resolution stores only the option id. If two different raw values
  // would read the same, the raw values are shown instead (this plan only).
  const conflictDisplayValues = (conflict: {
    key: "name" | "birthday" | "categoryId";
    survivor: string;
    absorbed: string;
  }): [string, string] => {
    if (conflict.key !== "birthday") {
      return [conflict.survivor, conflict.absorbed];
    }
    const survivor = formatStoredBirthdayForDisplay(conflict.survivor);
    const absorbed = formatStoredBirthdayForDisplay(conflict.absorbed);
    return survivor === absorbed
      ? [conflict.survivor, conflict.absorbed]
      : [survivor, absorbed];
  };

  return (
    <View style={styles.screen}>
      {header}
      <ScrollView contentContainerStyle={styles.root}>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          Choose the value to keep for every difference.
        </Text>
        {scalarConflicts.map((conflict) => (
          <FieldChoiceGroup
            key={conflict.key}
            label={conflict.label}
            options={choiceOptions(...conflictDisplayValues(conflict))}
            mode="conflict"
            selectedId={scalarChoices[conflict.key] ?? null}
            onChange={(option) =>
              setScalarChoices((current) => ({
                ...current,
                [conflict.key]: option.id,
              }))
            }
          />
        ))}
        {data.customFields.map((field) =>
          // D-129: a photo-type field holding two stored photos is a photo
          // choice; text left in a photo field is shown as text.
          field.kind === "photo" ? (
            <PhotoChoice
              key={field.field_def_id}
              label={field.label}
              mode="conflict"
              options={[
                {
                  id: "survivor",
                  photo: field.survivor_value,
                  uri: null,
                  name: data.survivor.name,
                  provenance: provenance(data.survivor.name),
                },
                {
                  id: "absorbed",
                  photo: field.absorbed_value,
                  uri: null,
                  name: data.absorbed.name,
                  provenance: provenance(data.absorbed.name),
                },
              ]}
              selectedId={customFieldChoices[field.field_def_id] ?? null}
              onChange={(selection) =>
                setCustomFieldChoices((current) => ({
                  ...current,
                  [field.field_def_id]: customPhotoConflictChoice(selection),
                }))
              }
            />
          ) : (
            <FieldChoiceGroup
              key={field.field_def_id}
              label={field.label}
              // Render only (38.9 D-66): a Date field's choices show the
              // display form; the stored values and the choice id stay raw.
              options={choiceOptions(
                ...customConflictDisplayValues(
                  field.type,
                  field.survivor_value,
                  field.absorbed_value,
                ),
              )}
              mode="conflict"
              selectedId={customFieldChoices[field.field_def_id] ?? null}
              onChange={(option) =>
                setCustomFieldChoices((current) => ({
                  ...current,
                  [field.field_def_id]: option.id,
                }))
              }
            />
          ),
        )}
        {photoConflict ? (
          <PhotoChoice
            label="Photo"
            mode="conflict"
            options={[
              {
                id: "survivor",
                photo: data.survivor.photo,
                uri: null,
                name: data.survivor.name,
                provenance: provenance(data.survivor.name),
              },
              {
                id: "absorbed",
                photo: data.absorbed.photo,
                uri: null,
                name: data.absorbed.name,
                provenance: provenance(data.absorbed.name),
              },
            ]}
            selectedId={photoChoice}
            onChange={(selection) => setPhotoChoice(selection)}
          />
        ) : null}
        {primaryTypes.map((type) => {
          const conflict = data.primaryByType[type]!;
          return (
            <FieldChoiceGroup
              key={type}
              label={`Primary ${type}`}
              mode="conflict"
              options={choiceOptions(
                conflict.survivor.display_value,
                conflict.absorbed.display_value,
              )}
              selectedId={primaryChoices[type] ?? null}
              onChange={(option) => {
                const groups: MethodGroups = {
                  phone:
                    type === "phone"
                      ? [
                          {
                            uid: conflict.survivor.uid,
                            type,
                            value: conflict.survivor.raw_value,
                            extension: "",
                            label: "Main",
                            isPrimary: true,
                          },
                          {
                            uid: conflict.absorbed.uid,
                            type,
                            value: conflict.absorbed.raw_value,
                            extension: "",
                            label: "Main",
                            isPrimary: true,
                          },
                        ]
                      : [],
                  email:
                    type === "email"
                      ? [
                          {
                            uid: conflict.survivor.uid,
                            type,
                            value: conflict.survivor.raw_value,
                            extension: "",
                            label: "Main",
                            isPrimary: true,
                          },
                          {
                            uid: conflict.absorbed.uid,
                            type,
                            value: conflict.absorbed.raw_value,
                            extension: "",
                            label: "Main",
                            isPrimary: true,
                          },
                        ]
                      : [],
                };
                const chosen = choosePrimary(
                  groups,
                  option.id === "survivor"
                    ? conflict.survivor.uid
                    : conflict.absorbed.uid,
                )[type].find((method) => method.isPrimary);
                if (!chosen) return;
                setPrimaryChoices((current) => ({
                  ...current,
                  [type]:
                    chosen.uid === conflict.survivor.uid
                      ? "survivor"
                      : "absorbed",
                }));
              }}
            />
          );
        })}
        <Pressable
          disabled={!ready}
          onPress={continueToSummary}
          style={[
            styles.cta,
            { backgroundColor: ready ? colors.accent : colors.surfaceElevated },
          ]}
        >
          <Text
            style={{ color: ready ? colors.onAccent : colors.textSecondary }}
          >
            Continue
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  root: { flexGrow: 1, padding: 20, gap: 16 },
  body: { fontSize: 15, lineHeight: 22 },
  cta: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
});
