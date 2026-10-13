/**
 * KeyboardCenteringProvider — how an `EntryTextField` finds the screen that
 * centres it above the keyboard (38.10 D-66; convergence c1 F-U1, Codex C-11
 * / Claude C-01, C-09).
 *
 * A host screen runs `useKeyboardCentering({ scrollRef, contentRef })`, wraps
 * its ScrollView content in `<KeyboardCenteringProvider value={centering}>`
 * and renders the hook's `bottomSpacer` last. Every `EntryTextField` below
 * calls the context on focus and on blur, so editors that render the field
 * (MemoryEditor, RelationshipEditor, OffLimitsForm) need no new props.
 *
 * With no provider the context is null and the field behaves the same minus
 * centring, so a screen outside D-66's scope never centres by accident. D-66
 * scope: Add/Edit Contact and the D-75 per-section editors only; an app-wide
 * rollout is out of scope (CONTEXT D-66).
 */
import {
  createContext,
  type ReactNode,
  type RefObject,
  useContext,
} from "react";
import type { TextInput } from "react-native";

/** The entry field's own TextInput ref, passed on focus and on blur. */
export type CenteringFieldRef = RefObject<TextInput | null>;

/** The memoised value `useKeyboardCentering` returns as `centering`. */
export interface KeyboardCentering {
  onFieldFocus(fieldRef: CenteringFieldRef): void;
  onFieldBlur(fieldRef: CenteringFieldRef): void;
}

const KeyboardCenteringContext = createContext<KeyboardCentering | null>(null);

export interface KeyboardCenteringProviderProps {
  value: KeyboardCentering;
  children: ReactNode;
}

export function KeyboardCenteringProvider({
  value,
  children,
}: KeyboardCenteringProviderProps) {
  return (
    <KeyboardCenteringContext.Provider value={value}>
      {children}
    </KeyboardCenteringContext.Provider>
  );
}

/** The nearest host's centring, or null outside a provider. */
export function useKeyboardCenteringContext(): KeyboardCentering | null {
  return useContext(KeyboardCenteringContext);
}
