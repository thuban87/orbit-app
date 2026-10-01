// CanvasKit shim exposing the subset of the RN-Skia imperative API Lab A uses.
const BLENDS=['Clear','Src','Dst','SrcOver','DstOver','SrcIn','DstIn','SrcOut','DstOut','SrcATop','DstATop','Xor','Plus','Modulate','Screen','Overlay','Darken','Lighten','ColorDodge','ColorBurn','HardLight','SoftLight','Difference','Exclusion','Multiply'];
module.exports=(ck)=>{
 const col=(c)=>ck.Color4f(c[0],c[1],c[2],c[3]);
 const cols=(a)=>a.map(col);
 const Paint=()=>{const p=new ck.Paint();return{p,setAntiAlias:(v)=>p.setAntiAlias(v),setStyle:(s)=>p.setStyle(s?ck.PaintStyle.Stroke:ck.PaintStyle.Fill),
  setBlendMode:(b)=>p.setBlendMode(ck.BlendMode[BLENDS[b]]),setStrokeWidth:(w)=>p.setStrokeWidth(w),setShader:(s)=>p.setShader(s),setPathEffect:(e)=>p.setPathEffect(e),
  setAlphaf:(a)=>p.setAlphaf(a),setColor:(c)=>p.setColor(col(c)),setStrokeCap:(c)=>p.setStrokeCap([ck.StrokeCap.Butt,ck.StrokeCap.Round,ck.StrokeCap.Square][c])}};
 const Matrix=()=>{const o={m:ck.Matrix.identity(),rotate(r){o.m=ck.Matrix.multiply(o.m,ck.Matrix.rotated(r));return o;}};return o;};
 const lm=(m)=>m?m.m:undefined;
 const Skia={Paint,Matrix,Color:(h)=>{const x=ck.parseColorString(h);return x;},
  Shader:{MakeRadialGradient:(c,r,cs,pos,mode,m)=>ck.Shader.MakeRadialGradient([c.x,c.y],r,cols(cs),pos,ck.TileMode.Clamp,lm(m)),
   MakeLinearGradient:(a,b,cs,pos,mode,m)=>ck.Shader.MakeLinearGradient([a.x,a.y],[b.x,b.y],cols(cs),pos,ck.TileMode.Clamp,lm(m)),
   MakeSweepGradient:(x,y,cs,pos,mode,m)=>ck.Shader.MakeSweepGradient(x,y,cols(cs),pos,ck.TileMode.Clamp,lm(m))},
  Path:{Make:()=>{const b=new ck.PathBuilder();const o={b,get p(){return b.snapshot()},addCircle:(x,y,r)=>b.addCircle(x,y,r),moveTo:(x,y)=>b.moveTo(x,y),lineTo:(x,y)=>b.lineTo(x,y)};return o;}},
  PathEffect:{MakeDash:(i,ph)=>ck.PathEffect.MakeDash(i,ph)},
  XYWHRect:(x,y,w,h)=>ck.XYWHRect(x,y,w,h)};
 const wrapCanvas=(c)=>({save:()=>c.save(),restore:()=>c.restore(),concat:(m)=>c.concat(m),translate:(x,y)=>c.translate(x,y),rotate:(d,x,y)=>c.rotate(d,x,y),scale:(x,y)=>c.scale(x,y),
  drawCircle:(x,y,r,p)=>c.drawCircle(x,y,r,p.p),drawPath:(path,p)=>c.drawPath(path.p,p.p),drawArc:(o,s,sw,u,p)=>c.drawArc(o,s,sw,u,p.p),drawLine:(a,b,x,y,p)=>c.drawLine(a,b,x,y,p.p)});
 return {Skia,wrapCanvas};
};
