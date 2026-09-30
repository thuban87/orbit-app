/**
 * The import duplicate choices (38.6 D-25 F-1): Duplicate review's "Choose an
 * existing contact" sheet and Import review's "might already be in Orbit"
 * choices both name an existing Orbit contact. Each choice carries that
 * contact's name and stored RELATIVE photo path from its header read, so the
 * row renders the photo through Avatar and follows the display revision (D-01).
 *
 * Pure: the caller supplies the header reader (`getContactHeader`), so this
 * module imports no DB code.
 */

/** The header fields a choice needs: the name and the stored relative photo. */
export interface ExistingContactHeader {
  name: string;
  photo: string | null;
}

/**
 * Read every candidate's header concurrently and return, in input order, each
 * candidate that still exists with its `name` and `photo` added. A candidate
 * whose contact is gone (null header) is dropped.
 */
export async function resolveExistingContactChoices<
  T extends { contactId: number },
>(
  candidates: readonly T[],
  readHeader: (contactId: number) => Promise<ExistingContactHeader | null>,
): Promise<Array<T & ExistingContactHeader>> {
  const headers = await Promise.all(
    candidates.map((candidate) => readHeader(candidate.contactId)),
  );
  const choices: Array<T & ExistingContactHeader> = [];
  candidates.forEach((candidate, index) => {
    const header = headers[index];
    if (header) {
      choices.push({ ...candidate, name: header.name, photo: header.photo });
    }
  });
  return choices;
}
