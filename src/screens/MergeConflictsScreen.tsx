import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { FieldChoiceGroup, type FieldChoiceOption } from "@/components/FieldChoiceGroup";
import { KEEP_ORBIT_PHOTO, PhotoChoice } from "@/components/PhotoChoice";
import { choosePrimary, type MethodGroups } from "@/components/contact-methods-editor-model";
import { getExecutor } from "@/db/database";
import type { MergeResolutions } from "@/db/merge-dao";
import type { ContactMethodType } from "@/logic/contact-method-normalization";
import type { RootStackScreenProps } from "@/navigation/types";
import { resolvePhotoUri } from "@/services/photos/photo-storage";
import { useTheme } from "@/theme";
import { hasResolvedMergeConflicts, type MergeConflictChoice } from "@/screens/merge-conflict-logic";

type ContactConflictRow = {
  id: number;
  name: string;
  birthday: string | null;
  category_id: number | null;
  category_label: string | null;
  photo: string | null;
};

type CustomConflictRow = {
  field_def_id: number;
  label: string;
  survivor_value: string | null;
  absorbed_value: string | null;
};

type PrimaryMethodRow = {
  uid: string;
  contact_id: number;
  method_type: ContactMethodType;
  raw_value: string;
  display_value: string;
  canonical_value: string | null;
};

type LoadedConflictData = {
  survivor: ContactConflictRow;
  absorbed: ContactConflictRow;
  customFields: CustomConflictRow[];
  primaryByType: Partial<Record<ContactMethodType, { survivor: PrimaryMethodRow; absorbed: PrimaryMethodRow }>>;
};

function meaningful(value: string | null): boolean {
  return value != null && value.trim().length > 0;
}

function differs(a: string | number | null, b: string | number | null): boolean {
  return a !== b && !(typeof a === "string" && typeof b === "string" && a.trim() === b.trim());
}

function primaryConflict(
  survivor: PrimaryMethodRow | undefined,
  absorbed: PrimaryMethodRow | undefined,
): survivor is PrimaryMethodRow {
  if (!survivor || !absorbed) return false;
  return (survivor.canonical_value ?? survivor.raw_value.trim()) !==
    (absorbed.canonical_value ?? absorbed.raw_value.trim());
}

function provenance(name: string): string {
  return `From ${name}`;
}

/** Resolve scalar and primary-method disputes before the destructive confirmation. */
export function MergeConflictsScreen({ navigation, route }: RootStackScreenProps<"MergeConflicts">) {
  const { colors } = useTheme();
  const { survivorId, absorbedId } = route.params;
  const [data, setData] = useState<LoadedConflictData | null>(null);
  const [failed, setFailed] = useState(false);
  const [scalarChoices, setScalarChoices] = useState<Record<string, MergeConflictChoice>>({});
  const [customFieldChoices, setCustomFieldChoices] = useState<Record<number, MergeConflictChoice>>({});
  const [primaryChoices, setPrimaryChoices] = useState<Partial<Record<ContactMethodType, MergeConflictChoice>>>({});
  const [photoChoice, setPhotoChoice] = useState<"survivor" | "absorbed" | typeof KEEP_ORBIT_PHOTO | null>(null);

  useEffect(() => {
    const exec = getExecutor();
    void (async () => {
      try {
        const contacts = await exec.getAllAsync<ContactConflictRow>(
          `SELECT c.id, c.name, c.birthday, c.category_id, c.photo, category.name AS category_label
             FROM contacts AS c
             LEFT JOIN categories AS category ON category.id = c.category_id
            WHERE c.id IN (?, ?) AND c.archived_at IS NULL`,
          [survivorId, absorbedId],
        );
        const survivor = contacts.find((contact) => contact.id === survivorId);
        const absorbed = contacts.find((contact) => contact.id === absorbedId);
        if (!survivor || !absorbed) throw new Error("merge contacts are unavailable");
        const [customFields, methods] = await Promise.all([
          exec.getAllAsync<CustomConflictRow>(
            `SELECT defs.id AS field_def_id, defs.label,
                    survivor_values.value AS survivor_value, absorbed_values.value AS absorbed_value
               FROM custom_field_defs AS defs
               JOIN custom_field_values AS survivor_values
                 ON survivor_values.field_def_id = defs.id AND survivor_values.contact_id = ?
               JOIN custom_field_values AS absorbed_values
                 ON absorbed_values.field_def_id = defs.id AND absorbed_values.contact_id = ?
              WHERE defs.quarantined_at IS NULL
                AND NULLIF(TRIM(COALESCE(survivor_values.value, '')), '') IS NOT NULL
                AND NULLIF(TRIM(COALESCE(absorbed_values.value, '')), '') IS NOT NULL
                AND survivor_values.value <> absorbed_values.value
              ORDER BY defs.display_order, defs.id`,
            [survivorId, absorbedId],
          ),
          exec.getAllAsync<PrimaryMethodRow>(
            `SELECT uid, contact_id, method_type, raw_value, display_value, canonical_value
               FROM contact_methods
              WHERE contact_id IN (?, ?) AND is_primary = 1`,
            [survivorId, absorbedId],
          ),
        ]);
        const primaryByType: LoadedConflictData["primaryByType"] = {};
        for (const type of ["phone", "email"] as const) {
          const own = methods.find((method) => method.contact_id === survivorId && method.method_type === type);
          const other = methods.find((method) => method.contact_id === absorbedId && method.method_type === type);
          if (primaryConflict(own, other) && other) primaryByType[type] = { survivor: own, absorbed: other };
        }
        setData({ survivor, absorbed, customFields, primaryByType });
      } catch {
        setFailed(true);
      }
    })();
  }, [absorbedId, survivorId]);

  const scalarConflicts = useMemo(() => {
    if (!data) return [] as Array<{ key: "name" | "birthday" | "categoryId"; label: string; survivor: string; absorbed: string }>;
    const values = [
      { key: "name" as const, label: "Name", survivor: data.survivor.name, absorbed: data.absorbed.name },
      { key: "birthday" as const, label: "Birthday", survivor: data.survivor.birthday, absorbed: data.absorbed.birthday },
      { key: "categoryId" as const, label: "Category", survivor: data.survivor.category_label, absorbed: data.absorbed.category_label },
    ];
    return values.filter((value) => meaningful(value.survivor) && meaningful(value.absorbed) && differs(value.survivor, value.absorbed)) as Array<{ key: "name" | "birthday" | "categoryId"; label: string; survivor: string; absorbed: string }>;
  }, [data]);
  const photoConflict = data != null && data.survivor.photo != null && data.absorbed.photo != null && data.survivor.photo !== data.absorbed.photo;
  const primaryTypes = data ? (Object.keys(data.primaryByType) as ContactMethodType[]) : [];
  const ready = data != null && hasResolvedMergeConflicts({
    scalarKeys: scalarConflicts.map((conflict) => conflict.key),
    customFieldIds: data?.customFields.map((field) => field.field_def_id) ?? [],
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
      ...(Object.keys(customFieldChoices).length ? { customFields: customFieldChoices } : {}),
      ...(Object.keys(primaryChoices).length ? { primaryMethod: primaryChoices } : {}),
      ...(photoChoice === "absorbed" && data.absorbed.photo ? { photo: { choice: "absorbed", relative: data.absorbed.photo } } : {}),
    };
    navigation.navigate("MergeImpactSummary", { survivorId, absorbedId, resolutions });
  };

  if (failed) return <View style={styles.root}><Text style={{ color: colors.danger }}>Couldn&apos;t load merge conflicts. Nothing was changed.</Text></View>;
  if (!data) return <View style={styles.root}><Text style={{ color: colors.textSecondary }}>Loading merge conflicts…</Text></View>;

  const choiceOptions = (survivor: string, absorbed: string): FieldChoiceOption<MergeConflictChoice>[] => [
    { id: "survivor", value: survivor, provenance: provenance(data.survivor.name) },
    { id: "absorbed", value: absorbed, provenance: provenance(data.absorbed.name) },
  ];

  return <ScrollView contentContainerStyle={styles.root}>
    <Text style={[styles.title, { color: colors.textPrimary }]}>Resolve merge conflicts</Text>
    <Text style={[styles.body, { color: colors.textSecondary }]}>Choose the value to keep for every difference.</Text>
    {scalarConflicts.map((conflict) => <FieldChoiceGroup key={conflict.key} label={conflict.label} options={choiceOptions(conflict.survivor, conflict.absorbed)} mode="conflict" selectedId={scalarChoices[conflict.key] ?? null} onChange={(option) => setScalarChoices((current) => ({ ...current, [conflict.key]: option.id }))} />)}
    {data.customFields.map((field) => <FieldChoiceGroup key={field.field_def_id} label={field.label} options={choiceOptions(field.survivor_value!, field.absorbed_value!)} mode="conflict" selectedId={customFieldChoices[field.field_def_id] ?? null} onChange={(option) => setCustomFieldChoices((current) => ({ ...current, [field.field_def_id]: option.id }))} />)}
    {photoConflict ? <PhotoChoice label="Photo" mode="conflict" options={[
      { id: "survivor", uri: resolvePhotoUri(data.survivor.photo!), name: data.survivor.name, provenance: provenance(data.survivor.name) },
      { id: "absorbed", uri: resolvePhotoUri(data.absorbed.photo!), name: data.absorbed.name, provenance: provenance(data.absorbed.name) },
    ]} selectedId={photoChoice} onChange={(selection) => setPhotoChoice(selection)} /> : null}
    {primaryTypes.map((type) => {
      const conflict = data.primaryByType[type]!;
      return <FieldChoiceGroup key={type} label={`Primary ${type}`} mode="conflict" options={choiceOptions(conflict.survivor.display_value, conflict.absorbed.display_value)} selectedId={primaryChoices[type] ?? null} onChange={(option) => {
        const groups: MethodGroups = {
          phone: type === "phone" ? [
            { uid: conflict.survivor.uid, type, value: conflict.survivor.raw_value, extension: "", label: "Main", isPrimary: true },
            { uid: conflict.absorbed.uid, type, value: conflict.absorbed.raw_value, extension: "", label: "Main", isPrimary: true },
          ] : [],
          email: type === "email" ? [
            { uid: conflict.survivor.uid, type, value: conflict.survivor.raw_value, extension: "", label: "Main", isPrimary: true },
            { uid: conflict.absorbed.uid, type, value: conflict.absorbed.raw_value, extension: "", label: "Main", isPrimary: true },
          ] : [],
        };
        const chosen = choosePrimary(
          groups,
          option.id === "survivor" ? conflict.survivor.uid : conflict.absorbed.uid,
        )[type].find((method) => method.isPrimary);
        if (!chosen) return;
        setPrimaryChoices((current) => ({
          ...current,
          [type]: chosen.uid === conflict.survivor.uid ? "survivor" : "absorbed",
        }));
      }} />;
    })}
    <Pressable disabled={!ready} onPress={continueToSummary} style={[styles.cta, { backgroundColor: ready ? colors.accent : colors.surfaceElevated }]}><Text style={{ color: ready ? colors.background : colors.textSecondary }}>Continue</Text></Pressable>
  </ScrollView>;
}

const styles = StyleSheet.create({
  root: { flexGrow: 1, padding: 20, gap: 16 },
  title: { fontSize: 24, fontWeight: "600" },
  body: { fontSize: 15, lineHeight: 22 },
  cta: { minHeight: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 8 },
});
