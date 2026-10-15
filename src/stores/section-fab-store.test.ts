import { beforeEach, describe, expect, it } from "vitest";
import {
  registerSectionFab,
  registerSectionFabAvailable,
  selectSectionFabAvailable,
  selectSectionFabPresent,
  unregisterSectionFab,
  unregisterSectionFabAvailable,
  useSectionFabStore,
} from "./section-fab-store";

const present = () => selectSectionFabPresent(useSectionFabStore.getState());

describe("section-fab-store (38.10 D-131, D-132)", () => {
  beforeEach(() => {
    useSectionFabStore.setState({ owners: new Set(), available: new Set() });
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

const available = () =>
  selectSectionFabAvailable(useSectionFabStore.getState());

describe("section-fab-store availability (38.10 D-151)", () => {
  beforeEach(() => {
    useSectionFabStore.setState({ owners: new Set(), available: new Set() });
  });

  it("availability is kept apart from presence", () => {
    registerSectionFabAvailable("a");
    expect(available()).toBe(true);
    expect(present()).toBe(false);
    registerSectionFab("a");
    unregisterSectionFab("a");
    expect(available()).toBe(true);
  });

  it("is idempotent per owner and keyed by owner", () => {
    registerSectionFabAvailable("a");
    const before = useSectionFabStore.getState().available;
    registerSectionFabAvailable("a");
    expect(useSectionFabStore.getState().available).toBe(before);
    registerSectionFabAvailable("b");
    unregisterSectionFabAvailable("a");
    expect(available()).toBe(true);
    unregisterSectionFabAvailable("b");
    expect(available()).toBe(false);
    const empty = useSectionFabStore.getState().available;
    unregisterSectionFabAvailable("zz");
    expect(useSectionFabStore.getState().available).toBe(empty);
  });
});
