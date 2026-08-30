import { describe, expect, it } from "vitest";
import { classifyPermissionResult } from "./read-contacts-permission-logic";

describe("classifyPermissionResult", () => {
  it("keeps a granted request granted", () => {
    expect(classifyPermissionResult("granted")).toBe("granted");
  });

  it("keeps a plain denial recoverable", () => {
    expect(classifyPermissionResult("denied")).toBe("denied");
  });

  it("recognizes the OS permanent-denial result", () => {
    expect(classifyPermissionResult("never_ask_again")).toBe("permanent");
  });
});
