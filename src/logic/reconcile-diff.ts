import {
  type ContactMethodType,
  normalizeContactMethod,
} from "@/logic/contact-method-normalization";
import { isBirthdayUnreadable } from "@/logic/picked-contact-map";
import { pickedMethodLabel } from "@/logic/picked-method-label";

export const RECONCILE_FIELD_FAMILIES = [
  "name",
  "phones",
  "emails",
  "birthday",
  "photo",
] as const;

export type ReconcileFieldFamily = (typeof RECONCILE_FIELD_FAMILIES)[number];
/**
 * Families stored in review memory (`reconcile_source_snapshot`). 'source' is
 * the missing-source "Keep as is" memory (migration 034, D-45); it is never a
 * classifier field family, so RECONCILE_FIELD_FAMILIES stays unchanged.
 */
export type ReviewMemoryFamily = ReconcileFieldFamily | "source";
export type ReconcileOutcome =
  | "additive"
  | "conflict"
  | "removed-from-source"
  | "missing-source"
  | "unchanged-since-review";

export interface ReconcileMethod {
  type: ContactMethodType;
  value: string;
  label?: string | null;
  /**
   * A phone source's raw ContactsContract TYPE / custom LABEL (38.12-02).
   * They name the option's label only; they never enter the family
   * serialization, so review memory is unchanged by them (D-47).
   */
  typeCode?: number | null;
  customLabel?: string | null;
}

export interface ReconcileSource {
  externalContactLinkId: number;
  displayName: string | null;
  methods: readonly ReconcileMethod[];
  birthday: string | null;
  /** Durable reconcile-staging relative path; never a picker cache URI. */
  stagedPhotoRelative?: string | null;
  /** SHA-256 (or equivalent) of the staged source-photo bytes. */
  photoContentHash?: string | null;
  provenanceLabel?: string;
}

export interface ReconcileOrbitContact {
  name: string | null;
  birthday: string | null;
  photo: string | null;
  methods: readonly ReconcileMethod[];
  modifiedAt?: string | null;
}

export interface ReconcileFieldOption {
  optionId: string;
  /** The comparison key (canonical for phones/emails); memory keys on it. */
  value: string | null;
  sourceLinkIds: number[];
  provenanceLabels: string[];
  stagedPhotoRelative?: string | null;
  /** Phones/emails: the phone's own value, as stored when applied (D-47). */
  rawValue?: string;
  /** Phones/emails: Orbit's label for the phone's TYPE/LABEL, if any (D-47). */
  label?: string | null;
}

export interface ReconcileFieldDiff {
  fieldFamily: ReconcileFieldFamily;
  outcome: ReconcileOutcome;
  orbitBaseline: string | null;
  sourceValue: string | null;
  /** Canonical memory of all source options, independent of the chosen value. */
  reviewedComparable: string | null;
  sourceOptions: ReconcileFieldOption[];
  reviewedValue: string | null;
  /**
   * Phones/emails: Orbit's current methods of that type, as stored, for the
   * detail screen to show one per line (D-47). `orbitBaseline` stays the
   * serialization used for memory comparison. Optional so stored diffs and
   * scalar fields type-check.
   */
  orbitMethods?: ReadonlyArray<{ value: string; label: string | null }>;
}

export interface ReconcileDiffResult {
  missingSource: boolean;
  fields: ReconcileFieldDiff[];
  /**
   * Every read source's link id (convergence c4 E-4). A field with no source
   * option (removed-from-source) remembers its review on these links. Optional
   * so stored diffs and existing literals still type-check; absent means [].
   */
  sourceLinkIds?: number[];
  /** The coarse card-level token persisted by the durable-card path. */
  orbitModifiedAt: string | null;
}

export interface ClassifyReconciliationInput {
  orbit: ReconcileOrbitContact;
  sources: readonly ReconcileSource[];
  lastReviewed: Partial<Record<ReconcileFieldFamily, string | null>>;
  /** Contacts Provider omissions are a missing-source card state, not removals. */
  omittedCount?: number;
  effectivePhoneRegion?: string | null;
}

const SERIALIZE_PART_SEPARATOR = "\u001f";
const SERIALIZE_TUPLE_SEPARATOR = "\u001e";

function canonicalMethod(
  method: ReconcileMethod,
  effectivePhoneRegion?: string | null,
): string | null {
  return normalizeContactMethod({
    type: method.type,
    value: method.value,
    defaultPhoneRegion: effectivePhoneRegion,
  }).canonicalValue;
}

/**
 * A stable source-memory value for one multi-method family. Labels intentionally
 * participate here, but never in Orbit-versus-source value equality: Android's
 * current PickedMethod bridge provides no source label at all.
 */
export function serializeMethodFamily(
  methods: readonly ReconcileMethod[],
  effectivePhoneRegion?: string | null,
): string {
  return methods
    .map((method) => ({
      type: method.type,
      canonical:
        canonicalMethod(method, effectivePhoneRegion) ?? method.value.trim(),
      label: method.label?.trim() ?? "",
    }))
    .sort(
      (left, right) =>
        left.type.localeCompare(right.type) ||
        left.canonical.localeCompare(right.canonical) ||
        left.label.localeCompare(right.label),
    )
    .map(({ type, canonical, label }) =>
      [type, canonical, label].join(SERIALIZE_PART_SEPARATOR),
    )
    .join(SERIALIZE_TUPLE_SEPARATOR);
}

function valuesForType(
  methods: readonly ReconcileMethod[],
  type: ContactMethodType,
  effectivePhoneRegion?: string | null,
): Map<string, ReconcileMethod> {
  const values = new Map<string, ReconcileMethod>();
  for (const method of methods) {
    if (method.type !== type) continue;
    const canonical = canonicalMethod(method, effectivePhoneRegion);
    if (canonical) values.set(canonical, method);
  }
  return values;
}

interface StableOptions {
  options: ReconcileFieldOption[];
  /** A phone birthday was present but failed the stored-birthday parser. */
  droppedUnreadable: boolean;
}

function stableOptions(
  sources: readonly ReconcileSource[],
  field: "name" | "birthday" | "photo",
): StableOptions {
  const byValue = new Map<string, ReconcileFieldOption>();
  let droppedUnreadable = false;
  for (const source of sources) {
    const value =
      field === "name"
        ? source.displayName
        : field === "birthday"
          ? source.birthday
          : (source.photoContentHash ?? null);
    if (value == null || value.trim() === "") continue;
    // D-45: an impossible phone birthday (e.g. 2021-02-29) is never offered.
    if (field === "birthday" && isBirthdayUnreadable(value)) {
      droppedUnreadable = true;
      continue;
    }
    const key = value;
    const option = byValue.get(key) ?? {
      optionId: `${field}:${encodeURIComponent(value)}`,
      value,
      sourceLinkIds: [],
      provenanceLabels: [],
      ...(field === "photo"
        ? { stagedPhotoRelative: source.stagedPhotoRelative ?? null }
        : {}),
    };
    option.sourceLinkIds.push(source.externalContactLinkId);
    if (source.provenanceLabel)
      option.provenanceLabels.push(source.provenanceLabel);
    byValue.set(key, option);
  }
  return {
    options: [...byValue.values()].sort((left, right) =>
      (left.value ?? "").localeCompare(right.value ?? ""),
    ),
    droppedUnreadable,
  };
}

function classifyScalar(
  fieldFamily: "name" | "birthday" | "photo",
  orbitBaseline: string | null,
  { options: sourceOptions, droppedUnreadable }: StableOptions,
  reviewedValue: string | null,
): ReconcileFieldDiff | null {
  // Only unreadable phone birthdays: nothing to offer, and the value was not
  // removed from the phone either (D-45).
  if (droppedUnreadable && sourceOptions.length === 0) return null;
  const sourceValue =
    sourceOptions.length === 1 ? sourceOptions[0].value : null;
  // Every family (photo included, convergence c4 E-4): the sorted option values
  // joined — "" for none, the value itself for one.
  const sourceComparable = sourceOptions
    .map((option) => option.value)
    .join(SERIALIZE_TUPLE_SEPARATOR);

  if (reviewedValue === sourceComparable) {
    return {
      fieldFamily,
      outcome: "unchanged-since-review",
      orbitBaseline,
      sourceValue,
      reviewedComparable: sourceComparable,
      sourceOptions,
      reviewedValue,
    };
  }

  if (sourceOptions.length === 0) {
    if (orbitBaseline == null || orbitBaseline === "") return null;
    return {
      fieldFamily,
      outcome: "removed-from-source",
      orbitBaseline,
      sourceValue: null,
      reviewedComparable: sourceComparable,
      sourceOptions,
      reviewedValue,
    };
  }

  if (orbitBaseline == null || orbitBaseline === "") {
    return {
      fieldFamily,
      outcome: "additive",
      orbitBaseline,
      sourceValue,
      reviewedComparable: sourceComparable,
      sourceOptions,
      reviewedValue,
    };
  }

  if (sourceOptions.length === 1 && sourceValue === orbitBaseline) return null;
  return {
    fieldFamily,
    outcome: "conflict",
    orbitBaseline,
    sourceValue,
    reviewedComparable: sourceComparable,
    sourceOptions,
    reviewedValue,
  };
}

function classifyMethodFamily(
  fieldFamily: "phones" | "emails",
  orbitMethods: readonly ReconcileMethod[],
  sources: readonly ReconcileSource[],
  reviewedValue: string | null,
  effectivePhoneRegion?: string | null,
): ReconcileFieldDiff | null {
  const type: ContactMethodType = fieldFamily === "phones" ? "phone" : "email";
  const orbit = valuesForType(orbitMethods, type, effectivePhoneRegion);
  const orbitOfType = orbitMethods.filter((method) => method.type === type);
  const readableOrbit = orbitOfType.map((method) => ({
    value: method.value,
    label: method.label ?? null,
  }));
  const sourceMethods = sources.flatMap((source) =>
    source.methods
      .filter((method) => method.type === type)
      .map((method) => ({ source, method })),
  );
  const source = new Map<
    string,
    { source: ReconcileSource; method: ReconcileMethod }
  >();
  for (const item of sourceMethods) {
    const canonical = canonicalMethod(item.method, effectivePhoneRegion);
    if (canonical && !source.has(canonical)) source.set(canonical, item);
  }
  const sourceSerialization = serializeMethodFamily(
    sourceMethods.map((item) => item.method),
    effectivePhoneRegion,
  );
  const sourceOptions = [...source.entries()]
    .map(([value, item]) => ({
      optionId: `${fieldFamily}:${encodeURIComponent(value)}`,
      value,
      sourceLinkIds: [item.source.externalContactLinkId],
      provenanceLabels: item.source.provenanceLabel
        ? [item.source.provenanceLabel]
        : [],
      // The canonical key stays the option's value (memory and equality key
      // on it); the raw value and label are what Apply stores (D-47).
      rawValue: item.method.value.trim(),
      label: pickedMethodLabel(
        type,
        item.method.typeCode,
        item.method.customLabel,
      ),
    }))
    .sort((left, right) => (left.value ?? "").localeCompare(right.value ?? ""));

  if (reviewedValue != null && reviewedValue === sourceSerialization) {
    return {
      fieldFamily,
      outcome: "unchanged-since-review",
      orbitBaseline: serializeMethodFamily(orbitOfType, effectivePhoneRegion),
      orbitMethods: readableOrbit,
      sourceValue: sourceSerialization,
      reviewedComparable: sourceSerialization,
      sourceOptions,
      reviewedValue,
    };
  }

  const additions = [...source.keys()].filter(
    (canonical) => !orbit.has(canonical),
  );
  const removals = [...orbit.keys()].filter(
    (canonical) => !source.has(canonical),
  );
  if (additions.length === 0 && removals.length === 0) return null;
  return {
    fieldFamily,
    outcome:
      additions.length > 0 && removals.length === 0
        ? "additive"
        : additions.length === 0
          ? "removed-from-source"
          : "conflict",
    orbitBaseline: serializeMethodFamily(orbitOfType, effectivePhoneRegion),
    orbitMethods: readableOrbit,
    sourceValue: sourceSerialization,
    reviewedComparable: sourceSerialization,
    sourceOptions,
    reviewedValue,
  };
}

/**
 * D-45: the fields a person still has to decide. The classifier keeps emitting
 * "unchanged-since-review" (memory equals the current source); every card,
 * count, chip and the detail view go through this filter instead.
 */
export function actionableReconcileFields(
  diff: Pick<ReconcileDiffResult, "fields">,
): ReconcileFieldDiff[] {
  return diff.fields.filter(
    (field) => field.outcome !== "unchanged-since-review",
  );
}

/** Pure reconciliation classification. Source contact reads and photo staging happen upstream. */
export function classifyReconciliation(
  input: ClassifyReconciliationInput,
): ReconcileDiffResult {
  const sourceLinkIds = input.sources.map(
    (source) => source.externalContactLinkId,
  );
  if (input.omittedCount && input.omittedCount > 0) {
    return {
      missingSource: true,
      sourceLinkIds,
      orbitModifiedAt: input.orbit.modifiedAt ?? null,
      fields: [
        {
          fieldFamily: "name",
          outcome: "missing-source",
          orbitBaseline: input.orbit.name,
          sourceValue: null,
          reviewedComparable: null,
          sourceOptions: [],
          reviewedValue: input.lastReviewed.name ?? null,
        },
      ],
    };
  }

  const scalarFields: ReconcileFieldDiff[] = [];
  for (const field of ["name", "birthday", "photo"] as const) {
    const fieldDiff = classifyScalar(
      field,
      field === "name"
        ? input.orbit.name
        : field === "birthday"
          ? input.orbit.birthday
          : input.orbit.photo,
      stableOptions(input.sources, field),
      input.lastReviewed[field] ?? null,
    );
    if (fieldDiff) scalarFields.push(fieldDiff);
  }

  const methodFields = (["phones", "emails"] as const)
    .map((field) =>
      classifyMethodFamily(
        field,
        input.orbit.methods,
        input.sources,
        input.lastReviewed[field] ?? null,
        input.effectivePhoneRegion,
      ),
    )
    .filter((field): field is ReconcileFieldDiff => field != null);

  return {
    missingSource: false,
    sourceLinkIds,
    orbitModifiedAt: input.orbit.modifiedAt ?? null,
    fields: RECONCILE_FIELD_FAMILIES.flatMap((family) =>
      [...scalarFields, ...methodFields].filter(
        (field) => field.fieldFamily === family,
      ),
    ),
  };
}

export function buildDesiredMethodList<T extends ReconcileMethod>(
  current: readonly T[],
  acceptedAdditions: readonly T[],
  effectivePhoneRegion?: string | null,
): T[] {
  const desired = new Map<string, T>();
  for (const method of [...current, ...acceptedAdditions]) {
    const canonical =
      canonicalMethod(method, effectivePhoneRegion) ?? method.value.trim();
    const key = `${method.type}\u0000${canonical}`;
    if (!desired.has(key)) desired.set(key, method);
  }
  return [...desired.values()];
}
