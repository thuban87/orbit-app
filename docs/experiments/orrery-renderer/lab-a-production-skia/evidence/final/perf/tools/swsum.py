import json,sys
rows=[json.loads(l) for l in open(sys.argv[1])]
for d in rows:
    tl=d['timeline']; n=d['name']
    mot=[(t,x) for t,x in tl if t<3.0]
    settle=max(t for t,x in mot if x>=0.8)
    nfr=len([1 for t,x in mot if t<=settle])
    late=[(t,x) for t,x in tl if t>3.0 and x>=0.8]
    g=json.load(open(f"m/{n}.json"))
    print(f"{n:18s} first={d['first_change_s']:.2f} settle={settle:.2f} frames_in_motion={nfr:2d} eff_fps={nfr/settle:4.1f} late={late}  gfx frames={g['frames']} p50={g['p50']} p90={g['p90']} p99={g['p99']} gpu50={g['gpu_p50']} gpu90={g['gpu_p90']}")
