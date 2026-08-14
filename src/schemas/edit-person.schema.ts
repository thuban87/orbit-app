/**
 * Built-in schema for editing an existing contact.
 *
 * Same fields as newPersonSchema but configured for editing:
 * - Title and submitLabel reflect editing context
 * - No output path (we're editing, not creating)
 * - Pre-populated with existing frontmatter values via initialValues
 */
import type { SchemaDef } from "./types";

export const editPersonSchema: SchemaDef = {
  id: "edit-person",
  title: "Edit Person",
  fields: [
    {
      key: "name",
      type: "text",
      label: "Name",
      placeholder: "Full name",
      required: true,
    },
    {
      key: "category",
      type: "dropdown",
      label: "Category",
      options: ["Family", "Friends", "Work", "Community"],
      required: true,
    },
    {
      key: "frequency",
      type: "dropdown",
      label: "Frequency",
      options: [
        "Daily",
        "Weekly",
        "Bi-Weekly",
        "Monthly",
        "Quarterly",
        "Bi-Annually",
        "Yearly",
      ],
      default: "Monthly",
      required: true,
    },
    {
      key: "social_battery",
      type: "dropdown",
      label: "Social Battery",
      options: ["Charger", "Neutral", "Drain"],
    },
    {
      key: "birthday",
      type: "date",
      label: "Birthday",
      layout: "half-width",
    },
    {
      key: "photo",
      type: "photo",
      label: "Photo",
      placeholder: "Enter a URL, local path, or wikilink",
      description:
        "Paste a URL, local path, or wikilink to the contact's photo",
    },
    {
      key: "contact_link",
      type: "text",
      label: "Contact Link",
      placeholder: "https://...",
    },
  ],
  submitLabel: "Save Changes",
};
