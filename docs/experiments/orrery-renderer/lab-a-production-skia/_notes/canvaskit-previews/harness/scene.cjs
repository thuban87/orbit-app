const L=require('./loader.cjs'); const {get,CK,OUT,hex,fs}=require('./shaders.cjs'); const mkShim=require('./shim.cjs');
const presets={gd:{background:'#0B0E1A',orreryVoid:'#04050B',orreryNebulaA:'#4A33A3',orreryNebulaB:'#16708F',orreryGrid:'#6F86C8',orreryStarlight:'#FFE7B8',orreryShadow:'#010207',textPrimary:'#E6E9F5',textSecondary:'#8B93B0',stable:'#45B98A',wob:'#E8C15C',dec:'#E56A52',rogue:'#E0904A',rogueB:'#3E4A6B',border:'#2A3048',sun:'#F2C14E'},
 gl:{background:'#EDF0F9',orreryVoid:'#C9D0E6',orreryNebulaA:'#C7CDEB',orreryNebulaB:'#E6D5C8',orreryGrid:'#3E4F86',orreryStarlight:'#C98A2E',orreryShadow:'#1A1F33',textPrimary:'#1A1F33',textSecondary:'#515A78',stable:'#1E7D5A',wob:'#8A6A12',dec:'#B33A22',rogue:'#9A5B14',rogueB:'#8892A8',border:'#D2D9EA',sun:'#F2C14E'}};
presets.sd={background:'#101216',orreryVoid:'#060709',orreryNebulaA:'#252B3D',orreryNebulaB:'#1E3438',orreryGrid:'#7A8494',orreryStarlight:'#F3E6CC',orreryShadow:'#020203',textPrimary:'#E9ECF1',textSecondary:'#9AA1AD',stable:'#4BB08A',wob:'#E2C065',dec:'#EA7059',rogue:'#DA9350',rogueB:'#414957',border:'#2E333C',sun:'#F2C14E'};
presets.sl={background:'#F2F3F6',orreryVoid:'#D5D8E0',orreryNebulaA:'#DADDE6',orreryNebulaB:'#E5DFD6',orreryGrid:'#4A5263',orreryStarlight:'#B07A2A',orreryShadow:'#1B1E26',textPrimary:'#1B1E26',textSecondary:'#565D6B',stable:'#1E7D5A',wob:'#836612',dec:'#B33A22',rogue:'#96591A',rogueB:'#7E889C',border:'#DADEE6',sun:'#F2C14E'};
const which=process.argv[2]||'gd'; const tilt=+(process.argv[3]||0.0); const yaw=+(process.argv[4]||0); const zoom=+(process.argv[5]||0.95); const prog=+(process.argv[6]||1);
CK().then(ck=>{ const T0=Date.now(); const tick=(m)=>console.log(m,Date.now()-T0);
 const {Skia,wrapCanvas}=mkShim(ck); L.setSkia(Skia);
 const {drawWorldPlane}=require('/home/bwales/projects/orbit-orrery-lab-a/src/components/orrery/lab/world-plane.ts');
 const {computeBodyLight,computeSwitchFx}=require('/home/bwales/projects/orbit-orrery-lab-a/src/components/orrery/lab/deep-field-math.ts');
 const {projectAnimatedFrame}=require('/home/bwales/projects/orbit-orrery-lab-a/src/logic/orrery-frame.ts');
 const {clampCameraPose}=require('/home/bwales/projects/orbit-orrery-lab-a/src/logic/orrery-camera-logic.ts');
 const {beginSwitchChoreography,sampleSwitchChoreography}=require('/home/bwales/projects/orbit-orrery-lab-a/src/logic/orrery-switch-choreography.ts');
 const P=presets[which]; const C=(h)=>Array.from(ck.parseColorString(h));
 const ink={chart:which.endsWith('l'),background:C(P.background),voidTone:C(P.orreryVoid),nebulaA:C(P.orreryNebulaA),nebulaB:C(P.orreryNebulaB),grid:C(P.orreryGrid),starlight:C(P.orreryStarlight),shadow:C(P.orreryShadow),textPrimary:C(P.textPrimary),textSecondary:C(P.textSecondary)};
 const statuses=['stable','stable','wob','stable','dec','null','stable','wob','rogue','stable','dec','null'];
 const world=statuses.map((st,i)=>{const ring=58+34*i; const a=((i*0.37+0.11)%1)*Math.PI*2; const dr= st==='dec'?20:st==='rogue'?80:0; const ang= st==='null'?0:a; return {id:i+1,kind:'contact',radius:16*(0.9+0.2*((i*7)%5)/4),ringRadius:ring,x:(ring+dr)*Math.sin(ang),y:-(ring+dr)*Math.cos(ang),st};});
 world.push({id:0,kind:'sun',radius:30,ringRadius:0,x:0,y:0});
 const extent=Math.max(...world.map(b=>Math.hypot(b.x,b.y)+b.radius));
 const W=412,H=840; const viewport={width:W,height:H};
 const pose=clampCameraPose({x:0,y:0,zoom,tilt,yaw},extent);
 let wb=world.map(b=>({...b,opacity:1,interactive:true}));
 let fx={active:false,roles:[],stages:[],velocity:0,flare:0,kick:0,progress:1};
 if(prog<1){ const src=wb.filter((b,i)=>i%3!==0); const dst=wb.filter((b,i)=>i%4!==1); const tr=beginSwitchChoreography(src,dst,2,{intensity:0.8,reducedMotion:false}); wb=sampleSwitchChoreography(tr,prog).world; fx=computeSwitchFx(tr,prog,false); }
 const frame=projectAnimatedFrame({generation:1,from:wb,to:wb},1,pose,viewport);
 const S=2; const surf=ck.MakeSurface(W*S,H*S); const c=surf.getCanvas(); c.scale(S,S);
 c.clear(ck.Color4f(...ink.background));
 // nebula
 const neb=ck.RuntimeEffect.Make(get('NEBULA_SKSL')); const np=new ck.Paint();
 const NW=Math.round(W*0.5),NH=Math.round(H*0.5); let nimg; const cachef=OUT+'nebcache-'+which+'.png';
 if(fs.existsSync(cachef)){nimg=ck.MakeImageFromEncoded(fs.readFileSync(cachef));} else { const ns=ck.MakeSurface(NW,NH); ns.getCanvas().scale(0.5,0.5);
 np.setShader(neb.makeShader([W,H,2.4,3.7,...ink.nebulaA,...ink.nebulaB,...(ink.chart?ink.grid:ink.starlight),ink.chart?1:0,ink.chart?0.55:0.8])); ns.getCanvas().drawRect(ck.LTRBRect(0,0,W,H),np);
 nimg=ns.makeImageSnapshot(); fs.writeFileSync(cachef,nimg.encodeToBytes()); }
 c.drawImageRectOptions(nimg,ck.XYWHRect(0,0,NW,NH),ck.XYWHRect(0,0,W,H),ck.FilterMode.Linear,ck.MipmapMode.None,null);
 tick('neb'); // stars
 let seed=1; const rnd=()=>{const x=Math.sin(seed++*12.9898)*43758.5453;return x-Math.floor(x)};
 const sp=new ck.Paint(); sp.setAntiAlias(true);
 const starCols=[P.textSecondary,P.textPrimary,'#DCE6FF','#F2C14E','#5CC6F0'];
 for(let i=0;i<(ink.chart?110:300);i++){const x=rnd()*W,y=rnd()*H,r=0.35+rnd()*(i<240?0.6:1.2); const cc=C(starCols[i%starCols.length]); sp.setColor(ck.Color4f(cc[0],cc[1],cc[2],(ink.chart?0.35:0.45+rnd()*0.55))); c.drawCircle(x,y,r,sp);}
 // vignette
 const v=new ck.Paint(); const vt=ink.voidTone; v.setShader(ck.Shader.MakeRadialGradient([W/2,H/2],Math.hypot(W,H)/2,[ck.Color4f(vt[0],vt[1],vt[2],0),ck.Color4f(vt[0],vt[1],vt[2],0),ck.Color4f(vt[0],vt[1],vt[2],ink.chart?0.32:0.78)],[0,0.42,1],ck.TileMode.Clamp)); c.drawRect(ck.LTRBRect(0,0,W,H),v);
 tick('vig'); // plane
 const colMap={stable:P.stable,wob:P.wob,dec:P.dec,rogue:P.rogue,null:P.border};
 const rings=world.filter(b=>b.kind==='contact').map(b=>({key:'contact:'+b.id,color:C(colMap[b.st]),width:b.st==='stable'||b.st==='null'?2:b.st==='dec'?4:3,strokeStyle:{stable:'solid',wob:'dashed',dec:'faded',rogue:'faintTrace',null:'solid'}[b.st],opacity:b.st==='null'?0.5:1,progress:b.st!=='null'}));
 drawWorldPlane(wrapCanvas(c),{frame,rings,fx,ink,extent});
 tick('plane'); // bodies sorted by depth
 const light=computeBodyLight(frame,extent);
 const bod=ck.RuntimeEffect.Make(get('BODY_SKSL')); const cor=ck.RuntimeEffect.Make(get('CORONA_SKSL'));
 const order=frame.bodies.map((b,i)=>i).sort((a,b)=>frame.bodies[a].depth-frame.bodies[b].depth);
 for(const i of order){const b=frame.bodies[i]; if(!b.visible) continue; c.save(); c.translate(b.x,b.y); c.saveLayer(null,null); const pa=new ck.Paint(); pa.setAntiAlias(true);
  if(b.kind==='sun'){ const R=b.radius; const cp=new ck.Paint(); cp.setShader(cor.makeShader([R,3.0,fx.flare*1.25,2.7,ink.chart?1:0,ink.chart?0.85:1,...ink.starlight,...C(P.sun)])); if(!ink.chart) cp.setBlendMode(ck.BlendMode.Screen); c.drawRect(ck.LTRBRect(-R*2.7,-R*2.7,R*2.7,R*2.7),cp); pa.setColor(ck.Color4f(...C(P.sun))); pa.setStyle(ck.PaintStyle.Stroke); pa.setStrokeWidth(2); c.drawCircle(0,0,R+1,pa); pa.setStyle(ck.PaintStyle.Fill); pa.setColor(ck.Color4f(0.66,0.55,0.88,1)); c.drawCircle(0,0,R,pa);}
  else { const w=world[b.id-1]; const fill=C(w.st==='rogue'?P.rogueB:colMap[w.st]); pa.setColor(ck.Color4f(...fill)); c.drawCircle(0,0,b.radius,pa);
   const ph=new ck.Paint(); ph.setAntiAlias(true); const r=b.radius; ph.setShader(ck.Shader.MakeLinearGradient([-r,-r],[r,r],[ck.Color4f(0.86,0.7,0.6,1),ck.Color4f(0.35,0.38,0.5,1)],null,ck.TileMode.Clamp)); c.drawCircle(0,0,r-1.5,ph);
   const l=light['contact:'+b.id]||[0,-1,0]; const bp=new ck.Paint(); bp.setAntiAlias(true);
   bp.setShader(bod.makeShader([r,l[0],l[1],l[2],0.6,ink.chart?0.36:0.62,ink.chart?0.7:0.85,ink.chart?0.8:0.55,1.28,ink.chart?1:0,...ink.shadow,...fill.slice(0,3),1,...ink.voidTone])); c.drawCircle(0,0,r*1.28,bp);}
  c.restore(); c.restore(); }
 fs.writeFileSync(OUT+`scene-${which}-${tilt}-${yaw}-${prog}.png`,surf.makeImageSnapshot().encodeToBytes());
 console.log('wrote');
}).catch(e=>console.error(e));
