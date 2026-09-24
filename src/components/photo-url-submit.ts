import {
  downloadImageToCache,
  type UrlImageErrorKind,
} from "@/services/photos/url-image";

export type UrlSubmitOutcome =
  | { status: "navigated" }
  | { status: "aborted" }
  | { status: "error"; kind: UrlImageErrorKind | "content"; cause: unknown };

/** Owns the handoff boundary: an abandoned download cannot navigate. */
export async function runUrlSubmit(args: {
  url: string;
  signal: AbortSignal;
  download?: typeof downloadImageToCache;
  navigate: (uri: string) => void;
}): Promise<UrlSubmitOutcome> {
  const { url, signal, download = downloadImageToCache, navigate } = args;
  if (signal.aborted) return { status: "aborted" };
  try {
    const uri = await download(url, { signal });
    if (signal.aborted) return { status: "aborted" };
    navigate(uri);
    return { status: "navigated" };
  } catch (cause) {
    if (signal.aborted) return { status: "aborted" };
    const kind =
      cause && typeof cause === "object" && "kind" in cause
        ? (cause as { kind: UrlImageErrorKind }).kind
        : "content";
    return { status: "error", kind, cause };
  }
}
