/**
 * Schema type definitions for the Orbit form modal system.
 *
 * These interfaces define the shape of form schemas used to
 * generate dynamic modal forms. Built-in schemas are TypeScript
 * files; user schemas are parsed from Markdown in Phase 6.
 */

/**
 * Supported field types for schema-driven forms.
 *
 * - text:     Single-line text input
 * - textarea: Multi-line text area
 * - dropdown: Select dropdown (requires options[])
 * - date:     Date picker (YYYY-MM-DD)
 * - toggle:   Boolean checkbox
 * - number:   Numeric input
 * - photo:    URL input (preview added in Phase 2)
 */
export type FieldType =
  | "text"
  | "textarea"
  | "dropdown"
  | "date"
  | "toggle"
  | "number"
  | "photo";

/**
 * Defines a single field in a schema-driven form.
 */
export interface FieldDef {
  /** Frontmatter key this field maps to */
  key: string;
  /** Input type to render */
  type: FieldType;
  /** Display label shown above the field */
  label: string;
  /** Placeholder text for text-like inputs */
  placeholder?: string;
  /** Whether the field must be filled before submission */
  required?: boolean;
  /** Default value when no initialValue is provided */
  default?: string | boolean | number;
  /** Options for dropdown fields */
  options?: string[];
  /** CSS layout hint for field width */
  layout?: "full-width" | "half-width" | "inline";
  /** Help text displayed below the field */
  description?: string;
}

/**
 * Defines a complete form schema for modal generation.
 */
export interface SchemaDef {
  /** Unique identifier for this schema */
  id: string;
  /** Title displayed at the top of the modal */
  title: string;
  /** Optional CSS class applied to the modal container */
  cssClass?: string;
  /** Ordered list of fields to render */
  fields: FieldDef[];
  /** Text for the submit button (default: "Save") */
  submitLabel?: string;
  /** Output configuration for file creation */
  output?: {
    /** Template path for file creation (e.g., "People/{{category}}/{{name}}.md") */
    path: string;
  };
  /** Markdown body template from user schema files (built-in schemas leave undefined) */
  bodyTemplate?: string;
}

/**
 * Runtime type guard for FieldDef objects.
 *
 * Validates that an unknown value has the required shape of a FieldDef.
 * Used by the schema loader (Phase 6) to validate user-authored schemas.
 */
export function isFieldDef(value: unknown): value is FieldDef {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj.key !== "string" || obj.key.length === 0) return false;
  if (typeof obj.type !== "string") return false;
  const validTypes: FieldType[] = [
    "text",
    "textarea",
    "dropdown",
    "date",
    "toggle",
    "number",
    "photo",
  ];
  if (!validTypes.includes(obj.type as FieldType)) return false;
  if (typeof obj.label !== "string" || obj.label.length === 0) return false;
  return true;
}

/**
 * Runtime type guard for SchemaDef objects.
 *
 * Validates that an unknown value has the required shape of a SchemaDef.
 * Used by the schema loader (Phase 6) to validate user-authored schemas.
 */
export function isSchemaDef(value: unknown): value is SchemaDef {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj.id !== "string" || obj.id.length === 0) return false;
  if (typeof obj.title !== "string" || obj.title.length === 0) return false;
  if (!Array.isArray(obj.fields)) return false;
  return obj.fields.every(isFieldDef);
}
