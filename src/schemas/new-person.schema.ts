/**
 * Built-in schema for creating a new contact.
 *
 * Defines the fields shown in the "Orbit: New Person" modal.
 * Used by ContactManager.createContact() to populate frontmatter
 * and template placeholders.
 */
import type { SchemaDef } from "./types";

export const newPersonSchema: SchemaDef = {
  id: "new-person",
  title: "New Person",
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
      default: "Family",
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
  submitLabel: "Create Contact",
};
