/** Byte-level fake of the recoverable .tmp/.bak master swap. */
export class FakePhotoFs {
  readonly files = new Map<string, string>();
  readonly writes: string[] = [];
  barrier?: (
    stage: "tmp" | "bak" | "replace",
    canonical: string,
  ) => Promise<void>;
  async persist(source: string, canonical: string): Promise<string> {
    this.files.set(`${canonical}.tmp`, this.files.get(source) ?? source);
    await this.barrier?.("tmp", canonical);
    const previous = this.files.get(canonical);
    if (previous !== undefined) {
      this.files.delete(canonical);
      this.files.set(`${canonical}.bak`, previous);
    }
    await this.barrier?.("bak", canonical);
    const staged = this.files.get(`${canonical}.tmp`);
    if (staged === undefined) throw new Error("missing staged bytes");
    this.files.set(canonical, staged);
    this.files.delete(`${canonical}.tmp`);
    this.writes.push(canonical);
    await this.barrier?.("replace", canonical);
    this.files.delete(`${canonical}.bak`);
    return canonical;
  }
  reconcile(canonical: string): void {
    this.files.delete(`${canonical}.tmp`);
    if (this.files.has(`${canonical}.bak`)) {
      const backup = this.files.get(`${canonical}.bak`);
      if (!this.files.has(canonical) && backup !== undefined)
        this.files.set(canonical, backup);
      this.files.delete(`${canonical}.bak`);
    }
  }
  pending(): Array<{ relative: string; isStageTmpOrphan: boolean }> {
    return [...this.files.keys()]
      .filter((path) => path.startsWith("avatars/_restore_pending/"))
      .map((relative) => ({
        relative,
        isStageTmpOrphan: relative.endsWith(".stage-tmp"),
      }));
  }
}
