import { getCountries } from "libphonenumber-js";
import { describe, expect, it } from "vitest";
import { COUNTRY_NAMES, countryName } from "./country-names";

describe("bundled country names (38.12 D-79)", () => {
  it("names every region the phone-region picker offers", () => {
    for (const code of getCountries()) {
      const name = COUNTRY_NAMES[code];
      expect(name, code).toBeTypeOf("string");
      expect(name?.trim(), code).not.toBe("");
      expect(name, code).not.toBe(code);
    }
  });

  it("uses the plain English names", () => {
    expect(countryName("US")).toBe("United States");
    expect(countryName("GB")).toBe("United Kingdom");
    expect(countryName("DE")).toBe("Germany");
  });

  it("falls back to the code for an unknown region", () => {
    expect(countryName("ZZ")).toBe("ZZ");
  });

  it("reads a lower-case code", () => {
    expect(countryName("de")).toBe("Germany");
  });
});
