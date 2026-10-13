import { describe, expect, it } from "vitest";
import { escapeLike } from "@/db/sql-like";

describe("escapeLike — backslash-first ordering preserved", () => {
  it("escapes backslash before % and _ (so added escapes are not re-escaped)", () => {
    expect(escapeLike("50%")).toBe("50\\%");
    expect(escapeLike("a_b")).toBe("a\\_b");
    // Backslash escaped FIRST: a literal `\%` becomes `\\` + `\%`.
    expect(escapeLike("\\%")).toBe("\\\\\\%");
    expect(escapeLike("plain")).toBe("plain");
  });
});
