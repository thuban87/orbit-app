---
status: issues_found
phase: 31-profile-experience
source: 31-01-SUMMARY.md, 31-02-SUMMARY.md, 31-03-SUMMARY.md, 31-04-SUMMARY.md, 31-05-SUMMARY.md, 31-06-SUMMARY.md, 31-07-SUMMARY.md, 31-08-SUMMARY.md, 31-09-SUMMARY.md
started: 2026-09-09T16:38:10-05:00
updated: 2026-09-10T03:41:27-05:00
---

## Current Test

[owner release smoke found three remaining functional gaps after the first six remediations passed]

## Tests

### 1. Profile background renders as intentional full-bleed art
expected: A selected bundled background fills the Profile viewport behind readable content, with no intrinsic-size tile, opaque grey field, or scroll-sticky artifact.
result: pass
reported: "The background is just not there... the entire page's background on every contact is an opaque grey color with a weird like 50x50px black box at the top left of the window that sticks with scrolling."
observed: "Plan 31-12 replaced the placeholder bundle with owner-approved artwork and repaired the full-viewport Profile renderer. Retained standalone-release Galaxy and Standard captures show full-bleed art, readable content, no black tile, and no opaque wash."
evidence: ".planning/phases/31-profile-experience/evidence/31-12-release/release-profile-galaxy-factory.png; .planning/phases/31-profile-experience/evidence/31-12-release/release-profile-standard-factory.png"

### 2. Profile layout chooser and editor use the available sheet height
expected: The chooser is sized to its content and the active editor provides a usable scrolling workspace with persistent reachable Save and Cancel controls.
result: pass
reported: "The profile layout is a full-screen-bottom-drawer but the contents of the menu only take up maybe the top 30% of the drawer... This also squeezes all of the editing options into a band that's like 100px tall."
observed: "Plan 31-11 repaired the expanded Sheet body and Plan 31-12 verified on the standalone Pixel release that the chooser is content-sized while the editor scrolls with Cancel and Save controls reachable above navigation."
evidence: ".planning/phases/31-profile-experience/evidence/31-12-release/release-layout-chooser-fixed.png; .planning/phases/31-profile-experience/evidence/31-12-release/release-layout-editor-fixed.png"

### 3. Background manager exposes its list and controls
expected: Choosing Background opens a usable manager whose background choices, assignment state, and actions are visible and scrollable.
result: pass
reported: "Choosing Backgrounds from the overflow menu brings up another full-screen bottom-drawer with a Back button but nothing else."
observed: "Plan 31-11 repaired the expanded manager workspace; Plan 31-12 inspected the real local empty state on the standalone Pixel release, where Back, Choose photo, and explanatory copy were visible."
evidence: ".planning/phases/31-profile-experience/evidence/31-12-release/release-background-manager-empty.png"

### 4. Factory Profile sections start collapsed
expected: A contact using the factory layout opens with Relationship Overview, Things to Remember, Contact Methods, and Interaction History collapsed while preserving per-contact persisted expansion choices thereafter.
result: pass
reported: "I feel like the 4 sections on the profile page need to default to collapsed, makes the pages much cleaner from the jump."
observed: "The factory document now sets all four top-level modules collapsed. Retained physical-Pixel captures show Relationship Overview, Things to Remember, Contact Methods, and Interaction History collapsed; resolver/DAO tests retain persisted-collapse precedence."
evidence: ".planning/phases/31-profile-experience/evidence/31-12-release/release-profile-galaxy-factory.png; src/profile/presentation-schema.test.ts; src/db/profile-presentation-dao.test.ts"

### 5. Profile app bar is compact
expected: Profile uses a compact app bar with an icon-only Back affordance and overflow while keeping Favorite with the fixed Hero; the shell consumes about one standard 56dp row rather than two tall rows.
result: pass
reported: "The header seems massively tall on the profile pages, like 100px or so... that header should be like 30% as tall as it currently is unless that box is meant to be something I'm missing."
observed: "Plan 31-11 installed a single 56dp Profile app bar with icon-only Back and overflow controls; retained 1.30x-font physical-Pixel capture shows those controls and collapsed sections reachable."
evidence: ".planning/phases/31-profile-experience/evidence/31-11-debug/08-profile-large-text-clean.png; src/screens/contact-profile-logic.test.ts"

### 6. Background cropper provides direct modern touch manipulation
expected: The complete source image is visible beneath a Profile-aspect selection box; one-finger drag repositions the selection, pinch resizes it within source bounds, and the primary crop screen does not require a horizontally scrolling strip of zoom or directional buttons.
result: pass
reported: "Touch doesn't appear to work on it at all outside of the control buttons. Can't pinch to zoom/unzoom, pan, nothing... the controls are all on one row meaning you have to scroll horizontally... I don't understand why this isn't a modern picture cropper like our profile picture cropper is."
observed: "Plan 31-13 physical-Pixel evidence proves direct one-finger drag on real portrait and landscape sources, source-bounded selection, and reflowing Fine tune controls. The owner subsequently performed and explicitly approved the genuine touch/pinch behavior, describing the final crop editor as ‘amazing and exactly what I was looking for.’"
evidence: ".planning/phases/31-profile-experience/evidence/31-13-debug/17-landscape-contained.png; .planning/phases/31-profile-experience/evidence/31-13-debug/20-portrait-contained.png; owner approval recorded in execution request 2026-09-10"

### 7. Layout editor supports direct drag reordering
expected: A section can be reordered by direct drag, while the named Move controls remain an equivalent non-precise fallback.
result: fail
reported: "No drag operations on the layout edit screen. Manual move button work fine though."
observed: "Owner release smoke confirms named Move controls work, but direct drag does not."
evidence: "owner release-smoke report 2026-09-10"

### 8. Layout templates are globally discoverable and assignable to any contact
expected: A layout template created from one Profile is visible from another Profile, and its assignment flow can target any individual contact rather than only the currently open Profile.
result: fail
reported: "Can't assign a template to another user individually... it only allows me to assign as global default, to one of the categories, or to the contact of the profile I'm currently in... [another contact's] layout editor doesn't list the other templates I've made elsewhere, it prompts to make a new template from scratch."
observed: "The current Profile-scoped manager exposes only the host contact as an individual assignment target, and the ordinary Profile Layout route does not expose the shared template library for an inherited-layout contact."
evidence: "owner release-smoke report 2026-09-10"

### 9. Background assignments can return to the theme default
expected: Global, Category, and contact background assignment surfaces expose a truthful clear/inherit action; clearing the global assignment returns Profiles without narrower overrides to the original theme background.
result: fail
reported: "I changed the global default background to a new picture... now there's no way to remove the picture from the background and just have a plain background like it was originally."
observed: "The assignment UI can set a global background template but provides no escape hatch that clears the global background axis."
evidence: "owner release-smoke report 2026-09-10"

### Deferred polish: layout-template preview

The owner reported that the template Preview page "looks like garbage" but explicitly accepted handling that visual treatment in a later polish pass. It is not part of this functional gap closure unless execution discovers that the preview is unusable rather than merely unattractive.

## Summary

total: 9
passed: 6
issues: 3
pending: 0
skipped: 0
blocked: 0

## Resolved gaps

- truth: "A selected bundled background fills the Profile viewport as intentional art behind readable content, with no intrinsic-size square or opaque-grey wash."
  status: resolved
  reason: "User reported an opaque grey background and a small black square fixed at the upper-left on every contact."
  resolved_by: "Plan 31-12 approved art and standalone Pixel release evidence."
  test: 1
  root_cause: "All eight bundled WebPs are 96x96 uniform-fill placeholders; BackgroundHost relies on absoluteFill without explicit image dimensions in the release renderer; and the Profile presentation surface opacity nearly hides the background."
  artifacts:
    - path: "assets/backgrounds/*.webp"
      issue: "Eight final named slots contain uniform 96x96 placeholder images instead of production artwork."
    - path: "src/components/ui/BackgroundHost.tsx"
      issue: "The local image layer does not establish explicit width/height coverage on the physical release renderer."
    - path: "src/theme/surface.ts"
      issue: "Global presentation surface opacity is too high for Profile background legibility and should not be weakened globally to fix one screen."
  resolved_evidence: "release-profile-galaxy-factory.png and release-profile-standard-factory.png"
  debug_session: "physical Pixel reproduction 2026-09-09"

- truth: "The layout chooser is content-sized and the expanded layout editor dedicates the available body height to a scrollable editing workspace with reachable Save and Cancel controls."
  status: resolved
  reason: "User reported a mostly empty full-screen drawer and an editor compressed into an approximately 100px band."
  resolved_by: "Plan 31-11 expanded Sheet repair and Plan 31-12 standalone-release evidence."
  test: 2
  root_cause: "ProfileLayoutEditor forces both chooser and editor through the expanded Sheet variant, while Sheet.body has no flex allocation; the nested flex root and ScrollView therefore collapse to content height inside a fixed 92%-height shell."
  artifacts:
    - path: "src/components/profile/ProfileLayoutEditor.tsx"
      issue: "Chooser and editor share the same forced expanded geometry despite different content needs."
    - path: "src/components/ui/Sheet.tsx"
      issue: "Expanded sheet body does not own the remaining vertical space required by flex/ScrollView children."
  resolved_evidence: "release-layout-chooser-fixed.png and release-layout-editor-fixed.png"
  debug_session: "physical Pixel reproduction 2026-09-09"

- truth: "The Background manager displays its list, assignment state, and controls in a usable scrollable sheet."
  status: resolved
  reason: "User reported that the Background drawer contains only a Back button."
  resolved_by: "Plan 31-11 manager geometry repair and Plan 31-12 standalone-release evidence."
  test: 3
  root_cause: "ProfileBackgroundManager places a flex root and ScrollView inside the same non-flex expanded Sheet.body, collapsing the manager content while leaving the fixed expanded shell visible."
  artifacts:
    - path: "src/components/profile/ProfileBackgroundManager.tsx"
      issue: "Manager content depends on parent height that the shared expanded sheet body does not provide."
    - path: "src/components/ui/Sheet.tsx"
      issue: "Expanded body geometry collapses the manager's flex content."
  resolved_evidence: "release-background-manager-empty.png; background-manager-model tests cover non-destructive loading/error/populated states."
  debug_session: "physical Pixel reproduction 2026-09-09"

- truth: "The four factory top-level Profile sections default to collapsed without overwriting saved per-contact expansion state."
  status: resolved
  reason: "Owner requested all four Profile sections default collapsed for a cleaner initial page."
  resolved_by: "Plan 31-11 factory-layout update and retained Pixel captures."
  test: 4
  root_cause: "FACTORY_PROFILE_LAYOUT marks every top-level section expanded:true."
  artifacts:
    - path: "src/profile/presentation-schema.ts"
      issue: "Factory defaults expand all four top-level sections."
  resolved_evidence: "presentation-schema and profile-presentation DAO tests; release-profile-galaxy-factory.png"
  debug_session: "source diagnosis 2026-09-09"

- truth: "Profile uses one compact app bar with icon-only Back and overflow while Favorite remains part of the fixed Hero."
  status: resolved
  reason: "User reported an approximately 100px header and requested it be reduced to roughly 30% of its current height."
  resolved_by: "Plan 31-11 compact app bar repair and retained 1.30x-font Pixel capture."
  test: 5
  root_cause: "ContactProfileScreen renders a standalone full-width text Back control above ProfileHero, while ProfileHero renders Favorite and overflow in a second utility row."
  artifacts:
    - path: "src/screens/ContactProfileScreen.tsx"
      issue: "Standalone text Back control creates a full extra header row."
    - path: "src/components/profile/ProfileHero.tsx"
      issue: "Overflow is separated from Back in a second utility row, compounding shell height."
  resolved_evidence: "08-profile-large-text-clean.png and contact-profile-logic.test.ts"
  debug_session: "physical Pixel reproduction 2026-09-09"

- truth: "The background cropper shows the complete source image with a Profile-aspect selection box that responds to drag and pinch, without an always-visible horizontally scrolling adjustment toolbar."
  status: resolved
  reason: "Plan 31-13 added the Modal-local Gesture Handler root, full-source bounded selection workspace, dim mask, and reflowing Fine tune disclosure. Retained physical-Pixel evidence proves direct one-finger drag on landscape and portrait sources plus named Fine tune zoom; the owner then directly approved genuine touch/pinch behavior."
  test: 6
  root_cause: "ProfileBackgroundManager renders GestureDetector inside BaseOverlay's native React Native Modal without a GestureHandlerRootView in that modal root; Android buttons therefore work while gesture-handler recognition does not. The current cover-image/fixed-viewport interaction and seven-button horizontal strip also do not match the owner-approved selection-box crop model."
  artifacts:
    - path: "src/components/ui/overlay-base.tsx"
      issue: "Resolved in Plan 31-13: the separate native Modal root now has its own GestureHandlerRootView."
    - path: "src/components/profile/ProfileBackgroundManager.tsx"
      issue: "Resolved in Plan 31-13: the full source is contained in a full-width gesture surface beneath the bounded selection, and ordinary controls reflow without a horizontal strip."
    - path: "src/services/photos/background-crop-geometry.ts"
      issue: "Resolved in Plan 31-13: source-selection geometry clamps translation and focal pinch resizing to the source."
    - path: ".planning/phases/31-profile-experience/31-NATIVE-CHECKLIST.md"
      issue: "Rows 43 and 44 claim PASS without evidence that physical drag or pinch changed the crop."
  resolved_evidence: "Plan 31-13 Pixel landscape/portrait artifacts plus owner approval recorded in execution request 2026-09-10."
  debug_session: "Plan 31-13 physical-Pixel debug evidence 2026-09-10; landscape/portrait direct drag and Fine tune verified, followed by owner direct touch/pinch approval"
