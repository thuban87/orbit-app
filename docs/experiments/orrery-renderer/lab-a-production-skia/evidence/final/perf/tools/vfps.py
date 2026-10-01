"""vfps.py clip.mp4 [thr] -> pts + content-change analysis (180x390 gray)."""
import sys, subprocess, json
from PIL import Image, ImageChops, ImageStat
v=sys.argv[1]; thr=float(sys.argv[2]) if len(sys.argv)>2 else 0.15
pts=subprocess.run(["ffprobe","-v","error","-select_streams","v:0","-show_entries","frame=pts_time","-of","csv=p=0",v],capture_output=True,text=True).stdout.split()
pts=[float(x.strip(',')) for x in pts if x.strip(',') not in ('','N/A')]
w,h=180,390
raw=subprocess.run(["ffmpeg","-loglevel","error","-i",v,"-fps_mode","passthrough","-vf",f"scale={w}:{h},format=gray","-f","rawvideo","-"],capture_output=True).stdout
n=len(raw)//(w*h)
fr=[Image.frombytes("L",(w,h),raw[i*w*h:(i+1)*w*h]).crop((0,30,w,h)) for i in range(n)]
d=[ImageStat.Stat(ImageChops.difference(fr[i],fr[i-1])).mean[0] for i in range(1,n)]
pts=pts[:n]
span=pts[-1]-pts[0] if n>1 else 0
ch=[i+1 for i,x in enumerate(d) if x>thr]
out={"frames":n,"dur":round(span,2),"pts_fps":round((n-1)/span,1) if span else None,"changed_frames":len(ch),"changed_fps":round(len(ch)/span,1) if span else None}
if "-v" in sys.argv: out["diffs"]=[round(x,2) for x in d]; out["pts"]=[round(x,3) for x in pts]
print(json.dumps(out))
