# Test portraits — provenance

**Purpose: TEST FIXTURES ONLY. Never ship, never bundle into the app, never use as marketing/store imagery.**
They exist so Lab B can judge whether contact photos stay recognisable inside the Orrery's lit sphere shaders (lighting, rim, decay desaturation). The emulator's seeded photos are flat silhouettes and cannot answer that.

All people depicted are **fictional, AI-generated**; none is a real, famous or identifiable person, and no likeness was requested. The logo (14) is an invented mark for no real company. No network image sources, stock photos or scraped images were used.

## Method
- Generator: Codex CLI `codex-cli 0.158.0`, model `gpt-5.6-sol` (from `~/.codex/config.toml`), built-in `image_generation` tool (feature flag `image_generation`, stable/on). Generated 2026-10-01.
- Invocation: `codex exec --skip-git-repo-check --sandbox workspace-write -C <scratch dir> "<brief>" < /dev/null`. Image 01 was a single-image probe; 02–16 ran as three parallel batches of five.
- Raw outputs: 1254×1254 RGB PNG (~1–2.8 MB), stored by codex under `~/.codex/generated_images/…` and copied to a scratch dir. Not kept in the repo.
- Every raw output was inspected visually (contact sheet + full-size check of 01); all 16 were accepted on the first pass, so no regeneration was needed. Small deviation: 11 is turned toward frame-right rather than the left the brief asked for. That is harmless for this use.
- Post-processing (local Python 3 + Pillow 10.2.0, script below): convert the embedded ICC profile to sRGB if one is present; flatten to opaque RGB; centre-crop to a square; Lanczos resize to 512×512; baseline JPEG at quality 88 with optimisation and an embedded sRGB ICC profile. The script steps quality down until the file is under 120 KB, but every file fit at q=88.

### Common brief (prefix of every batch prompt)
```
Role: these are TEST FIXTURES for a mobile contacts app that renders contact photos inside lit 3D sphere shaders (directional lighting, rim light, desaturation). We need to judge whether faces stay recognisable. Requirements for EVERY image: square 1:1, fully opaque (no transparency), no text, no watermark, no logos of real brands. Every person must be clearly FICTIONAL — not any real, famous or identifiable person, no likeness of anyone. Portraits: head-and-shoulders, face roughly centred, like a typical phone contact photo.
Use your image generation tool once per item below, and copy each generated file into the current directory with EXACTLY the given filename (PNG). Do not create any other files. Do not modify anything outside the current directory. At the end list each filename and the original generated path.
Items:
```
Image 01 used an equivalent single-image brief: "photographic-style head-and-shoulders portrait of a clearly FICTIONAL person (not any real or famous person, no likeness of anyone): a woman in her 60s with deep brown skin and short grey natural hair, soft window light from the left, plain warm mustard-yellow background, face centred and filling the middle ~60% of frame. No text, no watermark."

## Files
All files are 512×512 baseline JPEG, sRGB (ICC embedded), opaque RGB, q=88.

| File | Size (bytes) | Per-item prompt (after the common brief) | Test intent |
|---|---|---|---|
| `01-older-woman-black-mustard.jpg` | 44364 | (single-image probe, see above) woman 60s, deep brown skin, short grey natural hair, window light from left, mustard background. | dark skin on a bright warm background |
| `02-young-man-east-asian-bright-cyan.jpg` | 34149 | man in his 20s, East Asian, short black undercut hair, bright even studio light, saturated bright cyan background, neutral expression. | bright saturated background, even light |
| `03-teen-girl-south-asian-dark.jpg` | 41836 | teenage girl ~16, South Asian, long dark braid over shoulder, low-key moody light from right, near-black background. | dark background, low-key light |
| `04-older-man-white-busy-street.jpg` | 92987 | man in his 70s, pale freckled white skin, bald with white beard, outdoor in a busy colourful market street background (in focus enough to be busy), midday sun. | busy background, pale skin, bald head |
| `05-woman-latina-backlit-golden.jpg` | 49926 | woman in her 30s, Latina, curly brown shoulder-length hair, strong golden-hour backlight with lens flare, face slightly underexposed, warm orange background. | backlit, underexposed face |
| `06-man-black-glasses-office.jpg` | 74459 | man in his 40s, dark skin, short beard, rectangular glasses, cluttered office/bookshelf background, mixed indoor lighting. | busy indoor background, glasses |
| `07-child-red-hair-green.jpg` | 70838 | child ~8 years old, fair skin, bright red curly hair, freckles, big smile, grassy green park background softly blurred. | child, saturated hair and background |
| `08-woman-middle-eastern-hijab-pastel.jpg` | 36664 | woman in her 50s, Middle Eastern, wearing a navy hijab, soft diffuse light, pale pastel pink background. | head covering, pastel background |
| `09-man-indigenous-long-hair-dusk.jpg` | 40817 | man in his 30s, Indigenous American, long straight black hair, dusk blue-purple sky background, cool rim light. | cool dusk background, long hair |
| `10-woman-blonde-flash-selfie.jpg` | 48843 | woman in her 20s, light skin, platinum blonde bob, harsh on-camera phone flash selfie look at night, dark bar background with bokeh lights, slightly off-centre and tilted. | phone-flash selfie, tilted and off-centre |
| `11-man-southeast-asian-profile.jpg` | 48660 | man in his 50s, Southeast Asian, salt-and-pepper short hair, three-quarter profile turned to the left, overcast outdoor grey-white sky background. | three-quarter profile, flat overcast background |
| `12-low-contrast-foggy.jpg` | 31811 | VERY LOW CONTRAST photo: woman in her 40s, light-medium skin, light brown hair, beige sweater, against a beige/cream wall in flat foggy hazy light, overall washed-out and muted, almost no dark tones or shadows. Face still present but faint. | VERY LOW CONTRAST (washed-out, no darks) |
| `13-pet-dog.jpg` | 69474 | NOT a person: close-up of a scruffy brown-and-white terrier dog's face looking at camera, living-room background, typical pet photo used as a contact picture. | non-face: pet |
| `14-logo-graphic.jpg` | 16065 | NOT a person: a simple flat vector-style abstract logo graphic for a fictional company — a bold geometric shape (e.g. stylised orange hexagon with a white wave) on a solid dark teal background, centred, NO letters or text at all. | non-face: flat logo graphic |
| `15-landscape-mountains.jpg` | 71148 | NOT a person: a landscape photo — snowy mountain range over a lake under a bright blue sky, typical scenic photo someone uses as a contact picture. | non-face: landscape |
| `16-man-curly-afro-neon.jpg` | 62513 | man in his 20s, mixed-race medium-brown skin, big curly afro, magenta and blue neon lighting on the face, dark city night background. | coloured neon light on face, dark background |

## Conversion script (`convert.py <src.png> <dst.jpg>`)
```python
import sys, os, io
from PIL import Image, ImageCms
src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src)
icc = im.info.get('icc_profile')
if icc:
    im = ImageCms.profileToProfile(im, ImageCms.ImageCmsProfile(io.BytesIO(icc)), ImageCms.createProfile('sRGB'), outputMode='RGB')
if im.mode in ('RGBA','LA','P'):
    im = im.convert('RGBA'); bg = Image.new('RGB', im.size, (0,0,0)); bg.paste(im, mask=im.split()[3]); im = bg
im = im.convert('RGB')
w,h = im.size; s=min(w,h); im = im.crop(((w-s)//2,(h-s)//2,(w-s)//2+s,(h-s)//2+s)).resize((512,512), Image.LANCZOS)
srgb = ImageCms.ImageCmsProfile(ImageCms.createProfile('sRGB')).tobytes()
for q in range(88, 40, -4):
    buf = io.BytesIO(); im.save(buf, 'JPEG', quality=q, optimize=True, progressive=False, icc_profile=srgb)
    if buf.tell() < 120*1024: break
open(dst,'wb').write(buf.getvalue()); print(os.path.basename(dst), 'q=%d'%q, buf.tell())
```

## Keep / discard
Keep these as lab fixtures while the experiment runs. Before anything ships, move them to a test-only path or discard them. They must never reach a production bundle.
