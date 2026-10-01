import re
def sub(p, pairs):
    s=open(p).read()
    for a,b in pairs:
        assert a in s, (p,a[:60]); s=s.replace(a,b,1)
    open(p,'w').write(s)
L='src/components/orrery/lab/LabScene.tsx'
sub(L,[
 ('} from "./world-plane";\n','} from "./world-plane";\nimport { pmark, pnow } from "./_probe";\n'),
 ('    const current = frame.value;\n    const fx = switchFx.value;','    let tq = pnow();\n    const current = frame.value;\n    const fx = switchFx.value;'),
 ('      drawSky(canvas, sky, current, fx, nebulaAlpha);\n','      drawSky(canvas, sky, current, fx, nebulaAlpha);\n      tq = pmark("rec.sky", tq);\n'),
 ('      const polaris = polarisProjection(current, sceneExtent);','      tq = pmark("rec.plane", tq);\n      const polaris = polarisProjection(current, sceneExtent);'),
 ('    const above = createPicture((canvas) => {','    tq = pmark("rec.belowRest", tq);\n    const above = createPicture((canvas) => {'),
 ('    return { below, above };','    pmark("rec.above", tq);\n    return { below, above };'),
])
W='src/components/orrery/OrreryWorld.tsx'
sub(W,[
 ('import { LabScene } from "./lab/LabScene";','import { LabScene } from "./lab/LabScene";\nimport { pmark, pnow } from "./lab/_probe";'),
 ('  const frame = useDerivedValue(() => {\n    const sampled','  const frame = useDerivedValue(() => {\n    const t0 = pnow();\n    const sampled'),
 ('''      sampledCamera,
      viewport,
    );
  });''','''      sampledCamera,
      viewport,
    );
    pmark("frame", t0);
    return out;
  });'''),
 ('    return projectAnimatedFrame(\n      {\n        generation: switchTransition','    const out = projectAnimatedFrame(\n      {\n        generation: switchTransition'),
])
