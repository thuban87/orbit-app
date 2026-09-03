# Bundled font assets — provenance & license

Every font shipped in `assets/` is bundled locally (no CDN / network font
delivery — local-first, dossier §E). All three are licensed under the **SIL Open
Font License 1.1** (SIL OFL 1.1), which permits bundling and redistribution
inside an application.

| File | Family / Weight | Version | Source | License |
|------|-----------------|---------|--------|---------|
| `Inter-Regular.ttf` | Inter — Regular (400) | 3.019 | The Inter Project Authors — github.com/rsms/inter (static TTF via `@expo-google-fonts/inter`, `Inter_400Regular.ttf`) | SIL OFL 1.1 |
| `Inter-SemiBold.ttf` | Inter — SemiBold (600) | 4.000 | The Inter Project Authors — github.com/rsms/inter v4.0 release | SIL OFL 1.1 |
| `SpaceGrotesk-SemiBold.ttf` | Space Grotesk — SemiBold (600) | 2.x | The Space Grotesk Project Authors — github.com/floriankarsten/space-grotesk (static TTF via `@expo-google-fonts/space-grotesk`, `SpaceGrotesk_600SemiBold.ttf`) | SIL OFL 1.1 |

Notes:

- `Inter-Regular.ttf` (v3.019) and `Inter-SemiBold.ttf` (v4.000) are the same
  typeface family from different upstream releases; the minor metric difference
  between the two weights is acceptable for this primitives phase and is
  owner-retunable (both are SIL OFL 1.1 Inter statics).
- These TTFs feed the RN `<Text>` pipeline via `src/theme/fonts.ts`
  (`expo-font` `loadAsync`, folded into the `App.tsx` boot ready gate). The Skia
  Orrery font pipeline (`useFonts`) is a separate system and also consumes
  `Inter-SemiBold.ttf`.
- No `.ttf` here is delivered over the network at runtime; fonts load from the
  bundled asset only.
