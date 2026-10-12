---
created: 2026-10-12T00:00:00.000Z
title: Decide whether to keep "Hide from Profile" at all
area: things-to-remember
severity: minor
files:

  - src/components/profile/ThingsToRemember.tsx
  - src/screens/ContactProfileScreen.tsx

source: 38.10 dossier Q-47, owner 2026-10-12 — "Fix pin, get rid of that one hide occurrence and then ignore hide for now" (38.10 D-70, D-71 DEFERRED).
---

## Where things stand after 38.10

38.10 removes the dead "Hide from Profile" button from the Profile's entry sheet and fixes Pin. Hiding is otherwise untouched: the `hidden` columns on memories and key people, the editors' hidden switch / "Show on Profile", and the Profile's buggy "Show hidden" toggle (audit D-04: it leaves the Profile and drops its flag) all remain. Records: phase-10 dossier §AE/§AF (Hide decided), phase-03 §G (hidden is presentation only).

## Decide

Keep Hide (then fix "Show hidden" and give it a real entry point) or remove it everywhere (reverses phase-10 §AE/§AF; already-hidden items become visible).
