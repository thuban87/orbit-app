import {
  normalizeContactMethod,
  type ContactMethodType,
} from "@/logic/contact-method-normalization";

export const RECONCILE_FIELD_FAMILIES = [
  "name",
  "phones",
  "emails",
  "birthday",
  "photo",
] as const;

export type ReconcileFieldFamily = (typeof RECONCILE_FIELD_FAMILIES)[number];
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
  value: string | null;
  sourceLinkIds: number[];
  provenanceLabels: string[];
  stagedPhotoRelative?: string | null;
}

export interface ReconcileFieldDiff {
  fieldFamily: ReconcileFieldFamily;
  outcome: ReconcileOutcome;
  orbitBaseline: string | null;
  sourceValue: string | null;
  sourceOptions: ReconcileFieldOption[];
  reviewedValue: string | null;
}

export interface ReconcileDiffResult {
  missingSource: boolean;
  fields: ReconcileFieldDiff[];
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
      canonical: canonicalMethod(method, effectivePhoneRegion) ?? method.value.trim(),
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

function stableOptions(
  sources: readonly ReconcileSource[],
  field: "name" | "birthday" | "photo",
): ReconcileFieldOption[] {
  const byValue = new Map<string, ReconcileFieldOption>();
  for (const source of sources) {
    const value =
      field === "name"
        ? source.displayName
        : field === "birthday"
          ? source.birthday
          : source.photoContentHash ?? null;
    if (value == null || value.trim() === "") continue;
    const key = value;
    const option = byValue.get(key) ?? {
      value,
      sourceLinkIds: [],
      provenanceLabels: [],
      ...(field === "photo"
        ? { stagedPhotoRelative: source.stagedPhotoRelative ?? null }
        : {}),
    };
    option.sourceLinkIds.push(source.externalContactLinkId);
    if (source.provenanceLabel) option.provenanceLabels.push(source.provenanceLabel);
    byValue.set(key, option);
  }
  return [...byValue.values()].sort((left, right) =>
    (left.value ?? "").localeCompare(right.value ?? ""),
  );
}

function classifyScalar(
  fieldFamily: "name" | "birthday" | "photo",
  orbitBaseline: string | null,
  sourceOptions: ReconcileFieldOption[],
  reviewedValue: string | null,
): ReconcileFieldDiff | null {
  const sourceValue = sourceOptions.length === 1 ? sourceOptions[0].value : null;
  const sourceComparable =
    fieldFamily === "photo"
      ? sourceValue
      : sourceOptions.map((option) => option.value).join(SERIALIZE_TUPLE_SEPARATOR);

  if (sourceComparable != null && reviewedValue === sourceComparable) {
    return {
      fieldFamily,
      outcome: "unchanged-since-review",
      orbitBaseline,
      sourceValue,
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
  const sourceMethods = sources.flatMap((source) =>
    source.methods
      .filter((method) => method.type === type)
      .map((method) => ({ source, method })),
  );
  const source = new Map<string, { source: ReconcileSource; method: ReconcileMethod }>();
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
      value,
      sourceLinkIds: [item.source.externalContactLinkId],
      provenanceLabels: item.source.provenanceLabel ? [item.source.provenanceLabel] : [],
    }))
    .sort((left, right) => (left.value ?? "").localeCompare(right.value ?? ""));

  if (reviewedValue != null && reviewedValue === sourceSerialization) {
    return {
      fieldFamily,
      outcome: "unchanged-since-review",
      orbitBaseline: serializeMethodFamily(orbitMethods.filter((method) => method.type === type), effectivePhoneRegion),
      sourceValue: sourceSerialization,
      sourceOptions,
      reviewedValue,
    };
  }

  const additions = [...source.keys()].filter((canonical) => !orbit.has(canonical));
  const removals = [...orbit.keys()].filter((canonical) => !source.has(canonical));
  if (additions.length === 0 && removals.length === 0) return null;
  return {
    fieldFamily,
    outcome:
      additions.length > 0 && removals.length === 0
        ? "additive"
        : additions.length === 0
          ? "removed-from-source"
          : "conflict",
    orbitBaseline: serializeMethodFamily(orbitMethods.filter((method) => method.type === type), effectivePhoneRegion),
    sourceValue: sourceSerialization,
    sourceOptions,
    reviewedValue,
  };
}

/** Pure reconciliation classification. Source contact reads and photo staging happen upstream. */
export function classifyReconciliation(
  input: ClassifyReconciliationInput,
): ReconcileDiffResult {
  if (input.omittedCount && input.omittedCount > 0) {
    return {
      missingSource: true,
      orbitModifiedAt: input.orbit.modifiedAt ?? null,
      fields: [
        {
          fieldFamily: "name",
          outcome: "missing-source",
          orbitBaseline: input.orbit.name,
          sourceValue: null,
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
    const canonical = canonicalMethod(method, effectivePhoneRegion) ?? method.value.trim();
    const key = `${method.type}\u0000${canonical}`;
    if (!desired.has(key)) desired.set(key, method);
  }
  return [...desired.values()];
}
