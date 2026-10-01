const Module=require('module'); const path=require('path'); const ts=require('/home/bwales/projects/orbit-orrery-lab-a/node_modules/typescript');
const fs=require('fs'); const ROOT='/home/bwales/projects/orbit-orrery-lab-a/src/';
let skiaShim=null; module.exports.setSkia=(s)=>{skiaShim=s};
const orig=Module._resolveFilename;
Module._resolveFilename=function(req,parent,...r){
 if(req==='@shopify/react-native-skia') return '__skia__';
 if(req.startsWith('@/')){const b=ROOT+req.slice(2);for(const e of ['.ts','.tsx','/index.ts']) if(fs.existsSync(b+e)) return b+e;}
 if(parent&&parent.filename&&parent.filename.startsWith(ROOT)&&req.startsWith('.')){const b=path.resolve(path.dirname(parent.filename),req);for(const e of ['.ts','.tsx']) if(fs.existsSync(b+e)) return b+e;}
 return orig.call(this,req,parent,...r);};
const origLoad=Module._load; Module._load=function(req,parent,isMain){ if(req==='@shopify/react-native-skia') return {Skia:skiaShim}; return origLoad.apply(this,arguments);};
require.extensions['.ts']=function(m,f){const out=ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}});m._compile(out.outputText,f);};
