---
status: partial
phase: 31-profile-experience
source: 31-01-SUMMARY.md, 31-02-SUMMARY.md, 31-03-SUMMARY.md, 31-04-SUMMARY.md, 31-05-SUMMARY.md, 31-06-SUMMARY.md, 31-07-SUMMARY.md, 31-08-SUMMARY.md, 31-09-SUMMARY.md
started: 2026-09-09T16:38:10-05:00
updated: 2026-09-10T00:00:00-05:00
---

## Current Test

[testing paused — background crop interaction remains a blocker after the first remediation]

## Tests

### 1. Profile background renders as intentional full-bleed art
expected: A selected bundled background fills the Profile viewport behind readable content, with no intrinsic-size tile, opaque grey field, or scroll-sticky artifact.
result: issue
reported: "The background is just not there... the entire page's background on every contact is an opaque grey color with a weird like 50x50px black box at the top left of the window that sticks with scrolling."
severity: blocker

### 2. Profile layout chooser and editor use the available sheet height
expected: The chooser is sized to its content and the active editor provides a usable scrolling workspace with persistent reachable Save and Cancel controls.
result: issue
reported: "The profile layout is a full-screen-bottom-drawer but the contents of the menu only take up maybe the top 30% of the drawer... This also squeezes all of the editing options into a band that's like 100px tall."
severity: blocker

### 3. Background manager exposes its list and controls
expected: Choosing Background opens a usable manager whose background choices, assignment state, and actions are visible and scrollable.
result: issue
reported: "Choosing Backgrounds from the overflow menu brings up another full-screen bottom-drawer with a Back button but nothing else."
severity: blocker

### 4. Factory Profile sections start collapsed
expected: A contact using the factory layout opens with Relationship Overview, Things to Remember, Contact Methods, and Interaction History collapsed while preserving per-contact persisted expansion choices thereafter.
result: issue
reported: "I feel like the 4 sections on the profile page need to default to collapsed, makes the pages much cleaner from the jump."
severity: major

### 5. Profile app bar is compact
expected: Profile uses a compact app bar with an icon-only Back affordance and overflow while keeping Favorite with the fixed Hero; the shell consumes about one standard 56dp row rather than two tall rows.
result: issue
reported: "The header seems massively tall on the profile pages, like 100px or so... that header should be like 30% as tall as it currently is unless that box is meant to be something I'm missing."
severity: major

### 6. Background cropper provides direct modern touch manipulation
expected: The complete source image is visible beneath a Profile-aspect selection box; one-finger drag repositions the selection, pinch resizes it within source bounds, and the primary crop screen does not require a horizontally scrolling strip of zoom or directional buttons.
result: issue
reported: "Touch doesn't appear to work on it at all outside of the control buttons. Can't pinch to zoom/unzoom, pan, nothing... the controls are all on one row meaning you have to scroll horizontally... I don't understand why this isn't a modern picture cropper like our profile picture cropper is."
severity: blocker

## Summary

total: 6
passed: 0
issues: 6
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "A selected bundled background fills the Profile viewport as intentional art behind readable content, with no intrinsic-size square or opaque-grey wash."
  status: failed
  reason: "User reported an opaque grey background and a small black square fixed at the upper-left on every contact."
  severity: blocker
  test: 1
  root_cause: "All eight bundled WebPs are 96x96 uniform-fill placeholders; BackgroundHost relies on absoluteFill without explicit image dimensions in the release renderer; and the Profile presentation surface opacity nearly hides the background."
  artifacts:
    - path: "assets/backgrounds/*.webp"
      issue: "Eight final named slots contain uniform 96x96 placeholder images instead of production artwork."
    - path: "src/components/ui/BackgroundHost.tsx"
      issue: "The local image layer does not establish explicit width/height coverage on the physical release renderer."
    - path: "src/theme/surface.ts"
      issue: "Global presentation surface opacity is too high for Profile background legibility and should not be weakened globally to fix one screen."
  missing:
    - "Replace all eight placeholder WebPs with approved production assets for the existing Galaxy and Standard slot names."
    - "Give the background image explicit full-viewport cover geometry and verify it through release screenshots."
    - "Add Profile-specific semantic readability treatment that preserves AA contrast without changing shared GlassSurface opacity tokens."
  debug_session: "physical Pixel reproduction 2026-09-09"

- truth: "The layout chooser is content-sized and the expanded layout editor dedicates the available body height to a scrollable editing workspace with reachable Save and Cancel controls."
  status: failed
  reason: "User reported a mostly empty full-screen drawer and an editor compressed into an approximately 100px band."
  severity: blocker
  test: 2
  root_cause: "ProfileLayoutEditor forces both chooser and editor through the expanded Sheet variant, while Sheet.body has no flex allocation; the nested flex root and ScrollView therefore collapse to content height inside a fixed 92%-height shell."
  artifacts:
    - path: "src/components/profile/ProfileLayoutEditor.tsx"
      issue: "Chooser and editor share the same forced expanded geometry despite different content needs."
    - path: "src/components/ui/Sheet.tsx"
      issue: "Expanded sheet body does not own the remaining vertical space required by flex/ScrollView children."
  missing:
    - "Use an adaptive/detail chooser presentation and retain expanded presentation only for the editing workspace."
    - "Allocate remaining height to expanded sheet bodies without regressing compact/detail sheets."
    - "Add renderer-level and physical-device assertions for scrollable content plus persistent Save/Cancel reachability."
  debug_session: "physical Pixel reproduction 2026-09-09"

- truth: "The Background manager displays its list, assignment state, and controls in a usable scrollable sheet."
  status: failed
  reason: "User reported that the Background drawer contains only a Back button."
  severity: blocker
  test: 3
  root_cause: "ProfileBackgroundManager places a flex root and ScrollView inside the same non-flex expanded Sheet.body, collapsing the manager content while leaving the fixed expanded shell visible."
  artifacts:
    - path: "src/components/profile/ProfileBackgroundManager.tsx"
      issue: "Manager content depends on parent height that the shared expanded sheet body does not provide."
    - path: "src/components/ui/Sheet.tsx"
      issue: "Expanded body geometry collapses the manager's flex content."
  missing:
    - "Repair expanded-body layout and choose content-appropriate list versus crop/assignment sheet variants."
    - "Cover empty, populated, loading, and error manager states with visible/reachable actions."
    - "Verify manager content on the physical Pixel release renderer."
  debug_session: "physical Pixel reproduction 2026-09-09"

- truth: "The four factory top-level Profile sections default to collapsed without overwriting saved per-contact expansion state."
  status: failed
  reason: "Owner requested all four Profile sections default collapsed for a cleaner initial page."
  severity: major
  test: 4
  root_cause: "FACTORY_PROFILE_LAYOUT marks every top-level section expanded:true."
  artifacts:
    - path: "src/profile/presentation-schema.ts"
      issue: "Factory defaults expand all four top-level sections."
  missing:
    - "Set only the four factory top-level defaults to expanded:false."
    - "Prove existing persisted contact collapse maps and template-authored defaults retain precedence; do not migrate or reset user presentation state."
  debug_session: "source diagnosis 2026-09-09"

- truth: "Profile uses one compact app bar with icon-only Back and overflow while Favorite remains part of the fixed Hero."
  status: failed
  reason: "User reported an approximately 100px header and requested it be reduced to roughly 30% of its current height."
  severity: major
  test: 5
  root_cause: "ContactProfileScreen renders a standalone full-width text Back control above ProfileHero, while ProfileHero renders Favorite and overflow in a second utility row."
  artifacts:
    - path: "src/screens/ContactProfileScreen.tsx"
      issue: "Standalone text Back control creates a full extra header row."
    - path: "src/components/profile/ProfileHero.tsx"
      issue: "Overflow is separated from Back in a second utility row, compounding shell height."
  missing:
    - "Compose a single approximately 56dp app bar with 44x44 icon-only Back and overflow targets."
    - "Keep Favorite adjacent to identity in the fixed Hero and preserve origin-aware Back behavior."
    - "Verify long-name, large-text, accessibility-label, and source-stack navigation behavior on device."
  debug_session: "physical Pixel reproduction 2026-09-09"

- truth: "The background cropper shows the complete source image with a Profile-aspect selection box that responds to drag and pinch, without an always-visible horizontally scrolling adjustment toolbar."
  status: pending-owner-verification
  reason: "Plan 31-13 added the Modal-local Gesture Handler root, source-bounded selection workspace, dim mask, and Fine tune disclosure. Automated geometry/pipeline/type/color checks pass and the debug APK was installed on the authorized Pixel; direct drag and genuine two-pointer pinch remain pending owner observation."
  severity: blocker
  test: 6
  root_cause: "ProfileBackgroundManager renders GestureDetector inside BaseOverlay's native React Native Modal without a GestureHandlerRootView in that modal root; Android buttons therefore work while gesture-handler recognition does not. The current cover-image/fixed-viewport interaction and seven-button horizontal strip also do not match the owner-approved selection-box crop model."
  artifacts:
    - path: "src/components/ui/overlay-base.tsx"
      issue: "The separate native Modal root is not wrapped for react-native-gesture-handler on Android."
    - path: "src/components/profile/ProfileBackgroundManager.tsx"
      issue: "The crop UI transforms a cover-scaled image inside a nearly full-height fixed viewport and exposes Reset, zoom, and four movement buttons in a horizontal ScrollView."
    - path: "src/services/photos/background-crop-geometry.ts"
      issue: "Geometry models image pan/scale under a fixed destination viewport rather than an aspect-locked selection rectangle over a contained full-source preview."
    - path: ".planning/phases/31-profile-experience/31-NATIVE-CHECKLIST.md"
      issue: "Rows 43 and 44 claim PASS without evidence that physical drag or pinch changed the crop."
  missing:
    - "Provide a gesture-handler root for modal content and prove real Android drag and pinch recognition."
    - "Show the complete contained source image beneath a dimmed outside mask and movable/resizable Profile-aspect selection rectangle."
    - "Map the final selection rectangle directly to an in-bounds source-pixel crop while retaining the existing local JPEG derivative, output cap, naming, assignment, cancellation, and failure-safety behavior."
    - "Remove the always-visible horizontal zoom/direction strip; keep Cancel, Reset, and Use background primary, with any no-precise-drag fine adjustment behind one compact secondary action."
    - "Revoke the unsupported crop PASS and require physical-Pixel debug evidence of actual gesture-driven geometry changes before rebuilding a release APK."
  debug_session: "Plan 31-13 debug install 2026-09-10; owner two-pointer gesture verification pending"
