const {get,CK,OUT,hex,fs}=require('./shaders.cjs');
const P={gd:{bg:'#0B0E1A',star:'#FFE7B8',glow:'#F2C14E',shade:'#010207',void:'#04050B',stable:'#45B98A',wob:'#E8C15C',dec:'#E56A52',chart:0,sh:0.62,rim:0.85,halo:0.55},
gl:{bg:'#EDF0F9',star:'#C98A2E',glow:'#C98A2E',shade:'#1A1F33',void:'#C9D0E6',stable:'#1E7D5A',wob:'#8A6A12',dec:'#B33A22',chart:1,sh:0.36,rim:0.7,halo:0.8}};
CK().then(ck=>{
 const cor=ck.RuntimeEffect.Make(get('CORONA_SKSL')); const bod=ck.RuntimeEffect.Make(get('BODY_SKSL'));
 for(const [k,p] of Object.entries(P)){
  const W=780,H=560; const s=ck.MakeSurface(W,H); const c=s.getCanvas(); c.clear(ck.Color4f(...hex(p.bg)));
  const scale=3; // dp->px
  c.scale(scale,scale);
  // sun at 70,90 r 30
  c.save(); c.translate(80,90);
  const R=30, ext=2.7;
  const cp=new ck.Paint(); cp.setShader(cor.makeShader([R,3.0,0,ext,p.chart,1,...hex(p.star),...hex(p.glow)])); if(!p.chart) cp.setBlendMode(ck.BlendMode.Screen);
  c.drawRect(ck.LTRBRect(-R*ext,-R*ext,R*ext,R*ext),cp);
  const sw=new ck.Paint(); sw.setColor(ck.Color4f(...hex('#A98BE0'))); sw.setAntiAlias(true); c.drawCircle(0,0,R,sw);
  c.restore();
  // bodies
  const bodies=[[170,60,16,p.stable],[220,140,16,p.wob],[140,150,15,p.dec],[60,170,14,p.stable]];
  for(const [x,y,r,col] of bodies){
    c.save(); c.translate(x,y);
    const disc=new ck.Paint(); disc.setAntiAlias(true); disc.setColor(ck.Color4f(...hex(col))); c.drawCircle(0,0,r,disc);
    // fake photo: gradient
    const ph=new ck.Paint(); ph.setAntiAlias(true); ph.setShader(ck.Shader.MakeLinearGradient([-r,-r],[r,r],[ck.Color4f(0.85,0.7,0.6,1),ck.Color4f(0.3,0.35,0.5,1)],null,ck.TileMode.Clamp)); c.drawCircle(0,0,r-1.5,ph);
    const dx=80-x, dy=90-y, L=Math.hypot(dx,dy);
    const bp=new ck.Paint(); bp.setAntiAlias(true);
    bp.setShader(bod.makeShader([r,dx/L,dy/L,0,0.6,p.sh,p.rim,p.halo,1.28,p.chart,...hex(p.shade),...hex(col),...hex(p.void)]));
    c.drawCircle(0,0,r*1.28,bp);
    c.restore();
  }
  fs.writeFileSync(OUT+'bod-'+k+'.png',s.makeImageSnapshot().encodeToBytes());
 }
});
