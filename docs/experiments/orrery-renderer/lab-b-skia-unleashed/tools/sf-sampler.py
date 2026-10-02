#!/usr/bin/env python3
"""Presented-frame sampler for the OPAQUE canvas (SurfaceView), which gfxinfo cannot see.

`dumpsys SurfaceFlinger --latency <layer>` only keeps the last 128 presents (~1 s at
120 Hz), so this polls it every POLL s and unions the present timestamps.

Usage: sf-sampler.py <seconds> <out.txt>   (env ADB, PKG; or <stop-file> via SF_STOP)
Prints/writes: frames, fps, interval p50/p90/p99/max (ms), layer name.
"""
import os, subprocess, sys, time

ADB = os.environ.get("ADB", "adb").split()
PKG = os.environ.get("PKG", "com.bwales.orbit.labb")
POLL = float(os.environ.get("SF_POLL", "0.5"))


def sh(*args):
    return subprocess.run(ADB + ["shell", *args], capture_output=True, text=True).stdout


def layer():
    """The canvas SurfaceView layer; falls back to the app window (VRI-) when the
    canvas is a TextureView (opaqueCanvas:0, legacy renderer)."""
    lines = sh("dumpsys", "SurfaceFlinger", "--list").splitlines()
    names = [l for l in lines if f"SurfaceView[{PKG}" in l and "(BLAST)" in l]
    if not names:
        names = [l for l in lines if f"VRI-{PKG}" in l]
    if not names:
        return None
    # A dead canvas layer from an earlier mount can linger in the list (seen on
    # the Pixel: a stale #44353 listed LAST); the live one has the highest id.
    import re
    names.sort(key=lambda l: int((re.search(r"#(\d+)", l) or [0, 0])[1]))
    n = names[-1].replace("RequestedLayerState{", "")
    return n.split(" parentId")[0]


def main():
    secs = float(sys.argv[1]); out = sys.argv[2]
    stop = os.environ.get("SF_STOP")
    name = layer()
    sh("dumpsys", "SurfaceFlinger", "--latency-clear")
    ts = set()
    t_end = time.time() + secs
    while True:
        if name:
            for l in sh("dumpsys", "SurfaceFlinger", "--latency", f"'{name}'").splitlines()[1:]:
                p = l.split()
                if len(p) == 3 and 0 < int(p[1]) < 9e18:
                    ts.add(int(p[1]))
        if (stop and os.path.exists(stop)) or (not stop and time.time() > t_end):
            break
        time.sleep(POLL)
    t = sorted(ts)
    if len(t) < 2:
        res = f"sf_frames={len(t)} sf_fps=0 sf_p50=- sf_p90=- sf_p99=- sf_max=- layer={name}"
    else:
        d = sorted((b - a) / 1e6 for a, b in zip(t, t[1:]))
        span = (t[-1] - t[0]) / 1e9
        pick = lambda q: d[min(len(d) - 1, int(len(d) * q))]
        res = (f"sf_frames={len(t)} sf_span={span:.2f}s sf_fps={(len(t)-1)/span:.1f} "
               f"sf_p50={pick(.5):.1f} sf_p90={pick(.9):.1f} sf_p99={pick(.99):.1f} sf_max={d[-1]:.1f} layer={name}")
    open(out, "w").write(res + "\n")
    print(res)


if __name__ == "__main__":
    main()
