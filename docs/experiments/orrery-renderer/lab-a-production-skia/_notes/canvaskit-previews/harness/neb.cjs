const {get,CK,OUT,hex,fs}=require('./shaders.cjs');
const pals={gd:{bg:'#0B0E1A',A:'#4A33A3',B:'#16708F',glow:'#FFE7B8',grid:'#6F86C8',chart:0,alpha:0.95},
gl:{bg:'#EDF0F9',A:'#C7CDEB',B:'#E6D5C8',glow:'#C98A2E',grid:'#3E4F86',chart:1,alpha:0.55},
sd:{bg:'#101216',A:'#252B3D',B:'#1E3438',glow:'#F3E6CC',grid:'#7A8494',chart:0,alpha:0.95},
sl:{bg:'#F2F3F6',A:'#DADDE6',B:'#E5DFD6',glow:'#B07A2A',grid:'#4A5263',chart:1,alpha:0.55}};
CK().then(ck=>{
 const e=ck.RuntimeEffect.Make(get('NEBULA_SKSL'));
 for(const [k,p] of Object.entries(pals)){
  const W=300,H=650; const s=ck.MakeSurface(W,H); const c=s.getCanvas();
  c.clear(ck.Color4f(...hex(p.bg)));
  const u=[W,H,3.0,3.7,...hex(p.A),...hex(p.B),...(p.chart?hex(p.grid):hex(p.glow)),p.chart,p.alpha];
  const paint=new ck.Paint(); paint.setShader(e.makeShader(u)); c.drawRect(ck.LTRBRect(0,0,W,H),paint);
  // vignette
  const v=new ck.Paint(); const vt=p.chart?hex(p.chart?'#C9D0E6':'#04050B'):hex('#04050B');
  v.setShader(ck.Shader.MakeRadialGradient([W/2,H/2],Math.hypot(W,H)/2,[ck.Color4f(vt[0],vt[1],vt[2],0),ck.Color4f(vt[0],vt[1],vt[2],0),ck.Color4f(vt[0],vt[1],vt[2],p.chart?0.32:0.78)],[0,0.42,1],ck.TileMode.Clamp));
  c.drawRect(ck.LTRBRect(0,0,W,H),v);
  const img=s.makeImageSnapshot(); fs.writeFileSync(OUT+'neb-'+k+'.png',img.encodeToBytes());
 }
});
