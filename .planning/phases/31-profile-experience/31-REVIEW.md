---
phase: 31-profile-experience
reviewed: 2026-09-10T03:18:09Z
depth: deep
files_reviewed: 21
files_reviewed_list:
  - patches/react-native-screens+4.26.2.patch
  - src/components/profile/ProfileBackgroundManager.tsx
  - src/components/profile/ProfileHero.tsx
  - src/components/profile/ProfileLayoutEditor.tsx
  - src/components/ui/BackgroundHost.tsx
  - src/components/ui/Sheet.tsx
  - src/components/ui/sheet-contract.ts
  - src/components/ui/sheet-contract.test.ts
  - src/profile/background-manager-model.ts
  - src/profile/background-manager-model.test.ts
  - src/profile/presentation-schema.ts
  - src/profile/presentation-schema.test.ts
  - src/profile/resolve-presentation.test.ts
  - src/screens/ContactProfileScreen.tsx
  - src/screens/contact-profile-logic.ts
  - src/screens/contact-profile-logic.test.ts
  - src/theme/theme-presets.ts
  - src/theme/theme-presets.test.ts
  - src/theme/theme-types.ts
  - assets/backgrounds/README.md
  - docs/systems/profile.md
findings:
  critical: 3
  warning: 1
  info: 0
  total: 4
status: issues_found
---

# Phase 31: Code Review Report

**Reviewed:** 2026-09-10T03:18:09Z
**Depth:** deep
**Files Reviewed:** 21
**Status:** issues_found

## Summary

Reviewed the Phase 31 gap-closure implementation and, beyond the submitted file scope, traced all Sheet and BackgroundHost consumers, the Profile resolver/read/DAO/component path, theme background tokens, photo crop/storage flow, and the installed `react-native-screens` patch/build configuration. The focused test suite (110 tests), TypeScript check, colour check, patch reverse-apply check, and diff whitespace check pass, but they do not exercise the failure and handoff paths below. The Android patch applies to the pinned clean-install dependency; no defect was found in that patch.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Local background render errors never remain on the solid fallback

**Classification:** BLOCKER

**File:** `src/components/ui/BackgroundHost.tsx:107-117,132-153`

**Issue:** An app-owned `file://` background that fails to decode sets `renderFailed` at line 153. That removes `localUri` (lines 107-112), which changes `selectionKey` (line 113); the render-phase reset then immediately clears `renderFailed` (lines 115-117). The failing URI is selected again and retried, rather than latching onto the intended themed solid fallback. This breaks the local-render-failure degradation contract and can repeatedly attempt to render a corrupt or unavailable user background.

**Fix:** Key reset behavior to the independently validated original URI, not to `localUri` after it has been suppressed by `renderFailed`.

```ts
const appOwnedUri = appOwnedBackgroundUri?.startsWith("file://")
  ? appOwnedBackgroundUri
  : null;
const localUri = !forceRenderError && !renderFailed ? appOwnedUri : null;
const selectionKey = `${pkg}:${String(effectiveSlot)}:${String(appOwnedUri)}`;
```

Add a component-level regression test that fires `onError` for an app-owned URI and verifies the solid fallback remains rendered until a distinct selection/URI is supplied.

### CR-02: “Save as template” drops the layout editor’s draft and can save stale data

**Classification:** BLOCKER

**File:** `src/components/profile/ProfileLayoutEditor.tsx:377-384`; `src/screens/ContactProfileScreen.tsx:502-521`; `src/components/profile/ProfileTemplateManager.tsx:364-376`

**Issue:** The layout editor correctly passes its current `draft` to `onSaveAsTemplate`, but the screen callback at line 510 discards that argument and only changes the overlay. The template manager then uses the previously resolved `freeformLayout`, not the editor draft. For a freeform contact this creates a template from the old persisted layout; for an inherited/template/factory layout it exposes the editor action but the manager does not offer a matching “save current” path. In both cases unsaved editor changes are lost when the user follows the visible action, and the resulting template is wrong or cannot be created.

**Fix:** Keep the passed layout intent in screen-owned state and hand that exact immutable draft to the template manager when opening it; clear it only after creation/cancel is resolved. Only expose the action in contexts where the manager can save that supplied draft.

```ts
onSaveAsTemplate={(draft) => {
  setPendingTemplateLayout(draft);
  setOverlay("templates");
}}
// ProfileTemplateManager receives pendingTemplateLayout as its initial draft.
```

Add an integration test covering an edited layout followed by “Save as template”, asserting the created template contains the edited order/collapse settings and that an inherited layout does not present a dead-end action.

### CR-03: Imported-background crop geometry is landscape while the rendered Profile background is portrait/full-screen

**Classification:** BLOCKER

**File:** `src/components/profile/ProfileBackgroundManager.tsx:61-63,140-145,255-269,746-752`; `src/components/ui/BackgroundHost.tsx:93-94,139-150`; `src/screens/ContactProfileScreen.tsx:263-269`

**Issue:** The crop viewport and generated derivative are hard-coded to 360×240 (3:2 landscape). The Profile mounts `BackgroundHost` around its entire root, and `BackgroundHost` fills the current window dimensions with `resizeMode="cover"`. On the portrait app screen, the saved 3:2 image is therefore substantially re-cropped at render time. What the user positions in the crop editor cannot be the background they see on the Profile; portrait photos lose horizontal content after saving. The geometry tests reinforce the wrong assumption by describing 3:2 as the “actual landscape Profile aspect.”

**Fix:** Share the target geometry with the full-screen host and crop/render the derivative at that portrait aspect (or constrain the host to precisely the same measured target). Derive dimensions from the actual Profile viewport rather than hard-coded landscape constants, then update crop geometry and device/integration tests for portrait source, landscape source, and a real Profile viewport.

## Warnings

### WR-01: Background-template deletion errors escape without feedback or recovery

**Classification:** WARNING

**File:** `src/components/profile/ProfileBackgroundManager.tsx:530-542`; `src/db/profile-presentation-dao.ts:453-474`

**Issue:** The confirmation handler starts an async operation but has no `try`/`catch`. The DAO explicitly throws for a missing row and can reject on a transactional SQLite failure. In that case the promise is unhandled, the manager does not reuse its existing error state, and the user sees neither a failure message nor a retry path. A stale UI snapshot or transient local database failure therefore makes a destructive action appear to do nothing.

**Fix:** Wrap the handler in `try`/`catch`, log the failure, set a user-visible manager error, and refresh/read back only after a successful transaction.

```ts
try {
  const orphan = await deleteProfileBackgroundTemplate(/* ... */);
  if (orphan) deleteBackgroundDerivative(orphan);
  await refresh();
  onCommitted?.();
} catch (error) {
  Logger.error(LOG_SCOPE, "failed to delete background template", error);
  setListError("Couldn't delete that background. Try again.");
}
```

---

_Reviewed: 2026-09-10T03:18:09Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_
