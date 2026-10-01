"""swan.py NAME [thr] : tap-relative timeline of visible changes for m/NAME.{mp4,rec.txt,tap.txt}"""
import sys, json, subprocess, re
n=sys.argv[1]; thr=float(sys.argv[2]) if len(sys.argv)>2 else 0.3
D="/tmp/claude-1000/-home-bwales-projects-orbit-orrery-lab-a/44878eb8-0c41-47eb-9060-3cf82ab13373/scratchpad/rel/m/"
ca=[float(l.split()[0]) for l in open(D+n+".rec.txt") if "Content area" in l][0]
tp=[float(x) for x in open(D+n+".tap.txt").read().split()]
tap=tp[1]-ca  # after-stamp, relative to pts0 (assumed = Content area line)
d=json.loads(subprocess.run(["python3",D+"../vfps.py",D+n+".mp4",str(thr),"-v"],capture_output=True,text=True).stdout)
pts=d["pts"]; df=d["diffs"]
ev=[(round(pts[i+1]-tap,3),df[i]) for i in range(len(df)) if pts[i+1]>tap and df[i]>thr]
first=ev[0][0] if ev else None; last=ev[-1][0] if ev else None
# frames after tap during motion
inwin=[p for p in pts if p>tap]
out={"name":n,"tap_pts":round(tap,3),"tap_cmd_ms":round((tp[1]-tp[0])*1000),"first_change_s":first,"last_change_s":last,"n_changes":len(ev),
     "changes_per_s_first_to_last":round(len(ev)/(last-first),1) if ev and last>first else None,"timeline":[(t,round(x,1)) for t,x in ev]}
print(json.dumps(out))
