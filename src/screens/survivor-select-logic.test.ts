import { describe, expect, it, vi } from "vitest";
import {
  canContinueToImpact,
  makeCloseStepTwo,
  type SurvivorPairMember,
} from "./survivor-select-logic";

/**
 * Survivor select wrong-pair protection (38.9 D-14; review C6-M2) and the
 * step-two reset (review C7-L4).
 */

const A = 1;
const B = 2;
const C = 3;
const pairOf = (...ids: number[]): SurvivorPairMember[] =>
  ids.map((id) => ({ id }));

describe("canContinueToImpact (review C6-M2)", () => {
  it("is false until the current pair has loaded", () => {
    expect(
      canContinueToImpact({ first: A, second: B, pair: null, selected: A }),
    ).toBe(false);
    // A failed or missing read resolves to an empty pair.
    expect(
      canContinueToImpact({ first: A, second: B, pair: [], selected: A }),
    ).toBe(false);
  });

  it("is false with no second contact chosen (the picker step)", () => {
    for (const second of [undefined, null]) {
      expect(
        canContinueToImpact({
          first: A,
          second,
          pair: pairOf(A, B),
          selected: A,
        }),
      ).toBe(false);
    }
  });

  it("is false for a pair loaded for an earlier pick ({A,B} while second is C)", () => {
    expect(
      canContinueToImpact({
        first: A,
        second: C,
        pair: pairOf(A, B),
        selected: A,
      }),
    ).toBe(false);
    expect(
      canContinueToImpact({
        first: A,
        second: C,
        pair: pairOf(A, B),
        selected: B,
      }),
    ).toBe(false);
  });

  it("is false when the survivor pick is outside the pair", () => {
    expect(
      canContinueToImpact({
        first: A,
        second: B,
        pair: pairOf(A, B),
        selected: C,
      }),
    ).toBe(false);
    expect(
      canContinueToImpact({
        first: A,
        second: B,
        pair: pairOf(A, B),
        selected: null,
      }),
    ).toBe(false);
  });

  it("is false for a malformed pair (the same contact twice)", () => {
    expect(
      canContinueToImpact({
        first: A,
        second: B,
        pair: pairOf(A, A),
        selected: A,
      }),
    ).toBe(false);
  });

  it("is true for the matching pair and a pick inside it, in either order", () => {
    for (const pair of [pairOf(A, B), pairOf(B, A)]) {
      for (const selected of [A, B]) {
        expect(
          canContinueToImpact({ first: A, second: B, pair, selected }),
        ).toBe(true);
      }
    }
  });

  it("B chosen → Back (close) → C chosen with its read pending: Continue does nothing", () => {
    // The screen's state, driven through the same close the screen builds.
    const state: {
      second: number | undefined;
      pair: SurvivorPairMember[] | null;
      selected: number | null;
    } = { second: undefined, pair: null, selected: null };
    const close = makeCloseStepTwo<SurvivorPairMember[]>({
      setPair: (pair) => {
        state.pair = pair;
      },
      setSelected: (selected) => {
        state.selected = selected;
      },
      setParams: (params) => {
        state.second = params.secondContactId;
      },
    });
    const can = () =>
      canContinueToImpact({
        first: A,
        second: state.second,
        pair: state.pair,
        selected: state.selected,
      });

    // Pick B; its pair loads and the recommendation picks A.
    state.second = B;
    state.pair = pairOf(A, B);
    state.selected = A;
    expect(can()).toBe(true);

    // Back from step two returns to the picker and drops the pair and pick.
    close();
    expect(state).toEqual({ second: undefined, pair: null, selected: null });
    expect(can()).toBe(false);

    // Pick C; its read is still pending.
    state.second = C;
    expect(can()).toBe(false);

    // Even had the old pair and pick survived, they never match C.
    expect(
      canContinueToImpact({
        first: A,
        second: C,
        pair: pairOf(A, B),
        selected: A,
      }),
    ).toBe(false);

    // C's read resolves: Continue works for {A, C}.
    state.pair = pairOf(A, C);
    state.selected = C;
    expect(can()).toBe(true);
  });
});

describe("makeCloseStepTwo (review C7-L4)", () => {
  it("clears the pair, the survivor pick and secondContactId exactly once each", () => {
    const setPair = vi.fn();
    const setSelected = vi.fn();
    const setParams = vi.fn();
    const close = makeCloseStepTwo({ setPair, setSelected, setParams });

    expect(setPair).not.toHaveBeenCalled();
    close();

    expect(setPair).toHaveBeenCalledOnce();
    expect(setPair).toHaveBeenCalledWith(null);
    expect(setSelected).toHaveBeenCalledOnce();
    expect(setSelected).toHaveBeenCalledWith(null);
    expect(setParams).toHaveBeenCalledOnce();
    expect(setParams).toHaveBeenCalledWith({ secondContactId: undefined });
  });
});
