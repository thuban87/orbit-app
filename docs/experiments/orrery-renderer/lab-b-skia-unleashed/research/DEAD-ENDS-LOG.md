# Lab B — dead ends log

Ideas tried and dropped (or demoted to a toggle), with the commit that holds them.

| Date | WP | Idea | Why dropped | Recoverable at |
|---|---|---|---|---|
| 2026-10-01 | 1.1 | **Far star layer as an Atlas** (760 sprites, plus 410 mid/near; two Atlas draws) as the default | Emulator A/B (rings off): ~2× gfx p50 (32 vs 17 ms); twinkle-off did not help → cost is the per-replay `drawAtlas` of large buffers. Replaced by an analytic hash-grid star layer inside the nebula sample shader (zero CPU). The far Atlas code is kept **only as the fallback** when the nebula shader is off or null. | `54188b10` (default), fallback path in `LabEnvironment.tsx` (`farInShader`) |
| 2026-10-01 | 1.1 | **Live full-resolution fbm nebula** (≈17 noise evaluations × 5 octaves per pixel per frame, evolving warp) as the default | Same look as the bake (identical density function), but gfx p50 32 vs 18 ms with every frame janky on the emulator, even with a desktop GPU; on a phone it would be the C3 cost research 02 predicted. Kept as the `nebulaLive` panel flag for the R1 phone A/B. | flag `nebulaLive`, effect `nebulaLive` in `labb-effects.ts` (79cc89eb) |
| 2026-10-01 | 1.1 | "Render the live nebula at reduced resolution" (offscreen ¼-res per frame) | Not built: it needs a per-frame offscreen surface + snapshot on the UI thread (research 02 T6: C3, GPU-sync risk). The bake gives the same low-frequency image for one draw at mount; per-frame life comes from cheap sample-time warp/drift instead. | — (rejected on analysis) |
