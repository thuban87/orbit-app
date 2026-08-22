# Deferred items — Phase 14 (out-of-scope discoveries)

## 14-11

- **Pre-existing biome `noArrayIndexKey` in `src/screens/ComposeScreen.tsx`**
  (`key={`${t.category}-${i}`}` in the inspector-truncations `.map`, ~line 593
  after 14-11's added imports; line 558 in the pre-14-11 HEAD). Present before
  14-11 and unrelated to the model-layer changes — left untouched per the
  scope boundary. Fix later by keying on a stable field of the truncation entry
  rather than the array index.
