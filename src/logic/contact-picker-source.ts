/** Lightweight native summary row returned by the Contacts Provider. */
export interface ContactSummary {
  readonly lookupKey: string;
  readonly displayName: string | null;
  readonly methods: readonly string[];
  readonly photoThumbUri: string | null;
}

/** Presentation-neutral row consumed by the legacy picker screen. */
export interface ContactPickerRow {
  readonly lookupKey: string;
  readonly displayName: string;
  readonly primaryMethod: string | null;
  /** Every phone/email value, retained as the complete search index. */
  readonly searchMethods: readonly string[];
  /** Ephemeral external thumbnail URI; never a durable photo-storage path. */
  readonly photoThumbUri: string | null;
}

export function toPickerRows(
  summaries: readonly ContactSummary[],
): ContactPickerRow[] {
  return summaries.map((summary) => {
    const searchMethods = summary.methods.filter((method) => method.trim() !== "");
    return {
      lookupKey: summary.lookupKey,
      displayName: summary.displayName?.trim() || "Unnamed contact",
      primaryMethod: searchMethods[0] ?? null,
      searchMethods,
      photoThumbUri: summary.photoThumbUri,
    };
  });
}
