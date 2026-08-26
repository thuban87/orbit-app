/** A redacted operation label; never retain or log the native SAF error. */
export class SafWriteError extends Error {
  constructor(readonly stage: "create" | "write" | "read-back") {
    super(`SAF ${stage} failed`);
  }
}
