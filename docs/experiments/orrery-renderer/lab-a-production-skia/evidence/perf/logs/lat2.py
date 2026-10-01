import sys,re,glob
def ms(a,b): return (b-a)%100000
for f in sorted(glob.glob(sys.argv[1]+"/s*.log")):
    L=open(f).read().splitlines(); name=f.split("/")[-1][:-4]
    tap=[int(re.search(r"\] (\d+) #\d+ store ready->loading",l).group(1)) for l in L if "store ready->loading" in l]
    pub=[int(re.search(r"\] (\d+) #\d+ publish",l).group(1)) for l in L if "] " in l and " publish gen" in l and "isSwitch true" in l]
    first=[int(re.search(r"first switch frame at (\d+)",l).group(1)) for l in L if "first switch frame at" in l]
    done=[l for l in L if "switch done" in l]
    dav=[int(re.search(r"duration=(\d+)",l).group(1)) for l in L if "Davey!" in l]
    sk=[int(re.search(r"Skipped (\d+)",l).group(1)) for l in L if "Skipped" in l]
    if tap and pub and first and done:
        w=int(re.search(r"wall (\d+)ms",done[-1]).group(1)); fr=re.search(r"frames (\d+)",done[-1]).group(1); wk=re.search(r"work p50 (\d+)ms max (\d+)ms",done[-1])
        t,p,s=tap[-1],pub[-1],first[-1]
        print(f"{name}: tap->publish {ms(t,p)}ms | publish->first switch frame {ms(p,s)}ms | switch {w}ms, {fr} frame-worklet runs (work p50 {wk.group(1)} max {wk.group(2)}ms) | tap->settled {ms(t,s)+w}ms | maxDavey {max(dav) if dav else 0}ms, max skipped {max(sk) if sk else 0}")
    else: print(name, "incomplete", bool(tap), bool(pub), bool(first), bool(done))
