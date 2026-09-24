import { describe, expect, it, vi } from "vitest";

vi.mock("@/services/photos/url-image", () => ({
  downloadImageToCache: vi.fn(),
}));

import { runUrlSubmit } from "./photo-url-submit";

describe("runUrlSubmit", () => {
  it("does not navigate when abandoned before the download resolves", async () => {
    const controller = new AbortController();
    let finish!: (uri: string) => void;
    const download = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    );
    const navigate = vi.fn();
    const result = runUrlSubmit({
      url: "https://example.com/a.jpg",
      signal: controller.signal,
      download,
      navigate,
    });
    controller.abort();
    finish("file:///cache/a.jpg");
    await expect(result).resolves.toEqual({ status: "aborted" });
    expect(navigate).not.toHaveBeenCalled();
  });
});
