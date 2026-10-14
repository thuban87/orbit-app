import { beforeEach, describe, expect, it } from "vitest";
import {
  registerSectionFab,
  selectSectionFabPresent,
  unregisterSectionFab,
  useSectionFabStore,
} from "./section-fab-store";

const present = () => selectSectionFabPresent(useSectionFabStore.getState());

describe("section-fab-store (38.10 D-131, D-132)", () => {
  beforeEach(() => {
    useSectionFabStore.setState({ owners: new Set() });
  });

  it("starts with no section FAB present", () => {
    expect(present()).toBe(false);
  });

  it("register makes a section FAB present", () => {
    registerSectionFab("a");
    expect(present()).toBe(true);
  });

  it("registering the same owner twice is idempotent", () => {
    registerSectionFab("a");
    const before = useSectionFabStore.getState().owners;
    registerSectionFab("a");
    expect(useSectionFabStore.getState().owners).toBe(before);
    expect(useSectionFabStore.getState().owners.size).toBe(1);
    unregisterSectionFab("a");
    expect(present()).toBe(false);
  });

  it("unregistering one owner keeps another present", () => {
    registerSectionFab("a");
    registerSectionFab("b");
    unregisterSectionFab("a");
    expect(present()).toBe(true);
    unregisterSectionFab("b");
    expect(present()).toBe(false);
  });

  it("unregistering an unknown owner is a no-op", () => {
    registerSectionFab("a");
    const before = useSectionFabStore.getState().owners;
    unregisterSectionFab("zz");
    expect(useSectionFabStore.getState().owners).toBe(before);
    expect(present()).toBe(true);
  });
});
