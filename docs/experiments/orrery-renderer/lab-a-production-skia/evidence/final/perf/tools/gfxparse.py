"""gfxparse.py gfx.txt [framestats.txt] -> one-line summary (json)"""
import sys, re, json
t=open(sys.argv[1]).read()
# only the first (app) section until "View hierarchy" or "Pipeline"
def g(p, cast=float):
    m=re.search(p,t); return cast(m.group(1)) if m else None
r={}
r["frames"]=g(r"Total frames rendered: (\d+)",int)
r["janky_pct"]=g(r"Janky frames: \d+ \(([\d.]+)%\)")
r["janky_legacy_pct"]=g(r"Janky frames \(legacy\): \d+ \(([\d.]+)%\)")
for p in (50,90,95,99):
    r[f"p{p}"]=g(rf"^{p}th percentile: (\d+)ms",int) if False else None
for p in (50,90,95,99):
    m=re.search(rf"\n{p}th percentile: (\d+)ms",t); r[f"p{p}"]=int(m.group(1)) if m else None
    m=re.search(rf"\n{p}th gpu percentile: (\d+)ms",t); r[f"gpu_p{p}"]=int(m.group(1)) if m else None
for k,p in [("missed_vsync",r"Number Missed Vsync: (\d+)"),("high_input_lat",r"Number High input latency: (\d+)"),("slow_ui",r"Number Slow UI thread: (\d+)"),("slow_bitmap",r"Number Slow bitmap uploads: (\d+)"),("slow_draw",r"Number Slow issue draw commands: (\d+)"),("frame_deadline_missed",r"Number Frame deadline missed: (\d+)")]:
    r[k]=g(p,int)
if len(sys.argv)>2:
    fs=open(sys.argv[2]).read()
    rows=[]; hdr=None
    for line in fs.splitlines():
        if line.startswith("Flags,"): hdr=line.split(","); continue
        if hdr and re.match(r"^\d+,",line):
            v=line.split(",")
            if len(v)>=len(hdr)-1:
                d=dict(zip(hdr,v))
                if d.get("Flags")=="0": rows.append(d)
    since=int(re.search(r"Stats since: (\d+)ns",t).group(1)); rows=[d for d in rows if int(d.get("FrameCompleted","0") or 0)>0 and int(d["IntendedVsync"])>=since]; rows.sort(key=lambda d:int(d["IntendedVsync"]))
    if rows:
        iv=[int(d["IntendedVsync"]) for d in rows]; fc=[int(d["FrameCompleted"]) for d in rows]
        dur=sorted((c-i)/1e6 for i,c in zip(iv,fc))
        span=(max(fc)-min(fc))/1e9
        r["fs_rows"]=len(rows); r["fs_span_s"]=round(span,2)
        r["fs_fps"]=round((len(rows)-1)/span,1) if span>0 else None
        r["fs_dur_p50"]=round(dur[len(dur)//2],1); r["fs_dur_p90"]=round(dur[int(len(dur)*.9)],1)
        # gaps between completed frames
        gaps=sorted((b-a)/1e6 for a,b in zip(fc,fc[1:]))
        if gaps: r["fs_gap_p50"]=round(gaps[len(gaps)//2],1); r["fs_gap_p90"]=round(gaps[int(len(gaps)*.9)],1); r["fs_gap_max"]=round(gaps[-1],1)
    if rows:
        def pc(a,q): a=sorted(a); return round(a[min(len(a)-1,int(len(a)*q))],1)
        an=[(int(d["PerformTraversalsStart"])-int(d["AnimationStart"]))/1e6 for d in rows]
        sd=[(int(d["AnimationStart"])-int(d["IntendedVsync"]))/1e6 for d in rows]
        tr=[(int(d["SyncQueued"])-int(d["PerformTraversalsStart"]))/1e6 for d in rows if "SyncQueued" in d]
        rt=[(int(d["FrameCompleted"])-int(d["SyncStart"]))/1e6 for d in rows if "SyncStart" in d]
        r.update(anim_p50=pc(an,.5),anim_p90=pc(an,.9),startdelay_p50=pc(sd,.5),startdelay_p90=pc(sd,.9),trav_p50=pc(tr,.5) if tr else None,rt_p50=pc(rt,.5) if rt else None,rt_p90=pc(rt,.9) if rt else None)
print(json.dumps(r))
