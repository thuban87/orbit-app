# Phase 31 owner release smoke

This is the remaining human-only acceptance set after automated/code-backed
rows were credited in `31-NATIVE-CHECKLIST.md`. It consolidates the remaining
rows into seven journeys; it does not ask the owner to repeat deterministic DAO,
resolver, metric, persistence-failure, or local-first tests.

## Before starting

1. Install the release APK without clearing Orbit's app data:
   `C:\Users\bwales\projects\orbit-app\android\app\build\outputs\apk\release\app-release.apk`.
2. Use one ordinary Bound contact with a phone and email. Andrew Wales is fine
   if it still has those values.
3. For destructive presentation checks, use a temporary contact or a contact
   whose layout/background you do not mind resetting. Do not delete real contact
   data.
4. A result is a failure if a control clips, becomes unreachable, changes the
   wrong data, opens the wrong screen, or does not survive the stated relaunch.

## 1. Origin and one-shot routing — rows 3–6

- Open **Orrery**, note the selected System, select a person, choose **Open
  Profile**, then press Back. Confirm Orrery returns with the same System still
  selected.
- Open **Settings → Archived contacts**, open an archived contact, then press
  Back. Confirm you return to Archived contacts, not Dashboard or a blank screen.
- From the Android home-screen Orbit widget, tap a contact/Profile action. Confirm
  Profile opens; Back must land on Dashboard.
- From the widget, tap **Reach out** for a contact that has a phone or email.
  Confirm the Call/Text/Email chooser opens once. Dismiss it, leave Profile, and
  open that Profile normally; the chooser must not reopen by itself.
- If a real Orbit birthday/Profile notification is already available, tap it and
  confirm Back returns to Dashboard. Do not manufacture a notification solely
  for this smoke; its reset/guard behavior is covered by automated tests.

## 2. Hero, long data, Favorite, and native handoffs — rows 8–12, 18, 34

- Open a contact with no phone/email. Message and Call must keep their places and
  expose truthful disabled reasons; nothing should jump or collapse oddly.
- Open or temporarily create a contact with a very long name and Category. Set
  Android **Settings → Display & touch → Display size and text → Font size** to a
  large setting. Reopen Profile and expand **Relationship Overview** and
  **Contact Methods**. Text must wrap without overlap; tiles must reflow rather
  than clip; buttons must remain easy to tap.
- On a normal Bound contact, toggle Favorite, leave Profile, return, then fully
  close and relaunch Orbit. The chosen Favorite state must remain.
- Tap Profile **Message** and confirm Compose opens. Return without sending.
  Expand **Contact Methods**, then exercise Call, Message, and Email. Each must
  open the matching Android handoff with the right endpoint. Cancel each native
  handoff; Orbit must not claim that an interaction was completed.
- Open overflow once and confirm there is no Profile AI-draft action.

## 3. Things to Remember interaction ownership — row 30

- Expand **Things to Remember** on a contact that has at least one item.
- Tap an item and confirm its detail/history surface opens.
- Long-press an item and confirm the management action reaches the appropriate
  source-owner flow. Also invoke the visible/accessibility management action if
  offered; long press must not be the only route.

## 4. Layout edit, persistence, and conditional actions — rows 33, 36–38

- Open Profile overflow → **Profile Layout** → **Edit layout**.
- Confirm the fixed Hero preview remains fixed. Move one section by drag and a
  different section with a named Move control. Toggle one section's visibility
  or default expansion and try one offered size. Illegal sizes/moves must not be
  offered or silently applied.
- Press Cancel/Back with an unsaved change and discard it. Reopen the editor and
  confirm the committed layout did not change.
- Make one harmless change and press **Save layout**. Leave Profile, reopen it,
  then relaunch Orbit; the saved layout must remain.
- Reopen overflow. **Save Current Layout as Template** must now appear because the
  contact has a freeform layout; **Reset** must appear because it has a contact
  override.

## 5. Layout-template lifecycle — row 39

- Choose **Save Current Layout as Template**, name it `Phase 31 smoke`, and save.
- In the template manager, Preview it, open Usage, assign it to the temporary
  contact, rename it, and confirm the wording distinguishes global, Category,
  and contact assignment.
- Delete that template. Confirm the Profile falls back to its inherited layout
  and does not lose contact facts.

## 6. Background hierarchy and theme readability — rows 45–46

- On the temporary contact, overflow → **Background**, select a saved background,
  then **Assign**. Exercise **Set as global default**, one **Assign to [Category]**,
  and **Use for [contact]** in that order, checking a matching Profile after each.
  Contact must win over Category, and Category must win over global.
- Choose **Use inherited background for [contact]** and confirm the contact falls
  back to Category/global as appropriate. Relaunch Orbit and confirm the result
  persists with readable foreground/scrim treatment.
- Open **Settings → Appearance**. Check Galaxy and Standard and each available
  light/dark mode on the Profile. No grey wash, black tile, unreadable text, or
  lost hierarchy is acceptable.

## 7. Accessibility and reduced motion — rows 37, 47–49

- With the large font setting still enabled, revisit Profile, the Profile Layout
  editor, and Background. Save/Cancel/reorder controls and all text must remain
  visible and reachable.
- Enable TalkBack at Android **Settings → Accessibility → TalkBack**. On Profile,
  move focus through Hero actions, a disabled action, collapsed/expanded section,
  selected frequency, and an open sheet. Confirm each announces its purpose and
  state, and focus does not escape behind the sheet.
- Disable TalkBack. In Android Settings search for **Remove animations**, enable
  it, and revisit Profile overflow, layout, and crop. State changes must remain
  understandable even when transitions are suppressed.
- Restore your preferred font, TalkBack, and animation settings afterward.

## Reporting

Reply with either `Phase 31 owner smoke passed` or list the journey number,
checklist row, and what happened. Screenshots are useful for visual failures but
not required for a pass.
