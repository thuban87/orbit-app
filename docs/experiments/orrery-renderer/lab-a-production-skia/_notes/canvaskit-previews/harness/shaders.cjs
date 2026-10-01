const fs=require('fs');
const src=fs.readFileSync('/home/bwales/projects/orbit-orrery-lab-a/src/components/orrery/lab/deep-field-shaders.ts','utf8');
const get=(n)=>src.match(new RegExp('export const '+n+' = `([\\s\\S]*?)`;'))[1];
const CK=require('/home/bwales/projects/orbit-orrery-lab-a/node_modules/canvaskit-wasm/bin/full/canvaskit.js');
const OUT='/tmp/claude-1000/-home-bwales-projects-orbit-orrery-lab-a/44878eb8-0c41-47eb-9060-3cf82ab13373/scratchpad/prev/';
const hex=(h)=>[parseInt(h.slice(1,3),16)/255,parseInt(h.slice(3,5),16)/255,parseInt(h.slice(5,7),16)/255,1];
module.exports={get,CK,OUT,hex,fs};
if(require.main===module){CK().then(ck=>{for(const n of ['NEBULA_SKSL','CORONA_SKSL','BODY_SKSL']){const e=ck.RuntimeEffect.Make(get(n),(err)=>console.log(n,'ERR',err));console.log(n, e? 'ok floats='+e.getUniformFloatCount():'FAIL');}});}
