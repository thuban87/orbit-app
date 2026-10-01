#!/usr/bin/env python3
"""
ORRERY LAB A (experiment-only) — repeatable synthetic-data seeder.

Seeds com.bwales.orbit.laba (DEBUG build only — needs `run-as`) with a
deterministic synthetic sky for Orrery evaluation:

  * 8 "core" contacts across Family/Friends/Work/Community with varied
    cadence + recency: stable, wobble, decay, rogue (rarely-responds),
    a never-contacted contact (does not orbit, by design), 2 favourites,
    synthetic photo avatars on 4 of them, and 5 relationship satellites.
  * 32 "dense" contacts in a new category "Lab Dense" (a category System),
    every 3rd one with a photo.
  * 1 custom System "Lab Inner Circle" (rule: favorite=on, plus an include
    override for one Work contact).

It WIPES every contact (and cascades) in the Lab A package first, so it is
safe to re-run. It never touches com.bwales.orbit or any other package, never
edits phone Contacts, and makes no network/AI calls.

Mechanism: force-stop app -> pull orbit.db (+WAL/SHM) via `run-as cat` ->
apply seed with Python sqlite3 (WAL replayed + checkpointed locally, journal
reset to a single file) -> push db back via `run-as sh -c 'cat > ...'` and
delete device -wal/-shm -> push avatar JPEGs into files/avatars/.

last_contact is NOT hand-written: after inserting interactions the script runs
the exact recency recompute statement from src/db/recency-dao.ts so the single
writer's semantics (connected-only for rarely_responds) are reproduced.

Usage:
  python3 seed-lab-a.py                 # auto-detect the single adb device
  python3 seed-lab-a.py --serial XYZ    # explicit
  python3 seed-lab-a.py --satellites 1  # also flip orrery_satellites_enabled on
  python3 seed-lab-a.py --no-photos
Requires: ~/.local/bin/adb, python3 + Pillow (for avatars).
"""
import argparse
import datetime as dt
import os
import random
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import uuid

PKG = "com.bwales.orbit.laba"
ADB = os.path.expanduser("~/.local/bin/adb")
DB_DIR = "files/SQLite"
NS = uuid.UUID("6f1c2a52-9d7e-4c1a-9a51-1ab0a0000000")
EXPECTED_MIN_USER_VERSION = 32

# Category uids seeded by migration 001 (fixed values on a fresh install).
CAT = {"Family": 1, "Friends": 2, "Work": 3, "Community": 4}

# name, category, interval_days, days_since_last (None=never), fav_rank,
# rarely_responds, photo, satellites[(name, relation)]
CORE = [
    ("Ada Park", "Family", 14, 3, 1, 0, True, [("Mina", "Daughter"), ("Jun", "Partner")]),
    ("Ben Okafor", "Friends", 7, 6, None, 0, True, []),
    ("Clara Ruiz", "Work", 30, 45, None, 0, False, [("Tom", "Spouse")]),
    ("Dev Malhotra", "Friends", 21, 2, 2, 0, True, [("Rhea", "Sister")]),
    ("Elif Kaya", "Family", 60, 50, None, 0, False, [("Nora", "Mother")]),
    ("Felix Brandt", "Work", 14, 30, None, 1, False, []),
    ("Grace Liu", "Friends", 30, None, None, 0, False, []),
    ("Hugo Lemaire", "Community", 90, 10, None, 0, True, []),
]

DENSE_FIRST = ["Ari", "Bea", "Cal", "Dina", "Eli", "Fay", "Gus", "Hana", "Ivo", "Jill",
               "Kai", "Lena", "Milo", "Nia", "Otto", "Pia", "Quinn", "Rosa", "Sami", "Tess",
               "Umar", "Vera", "Wes", "Xena", "Yuri", "Zoe", "Abe", "Bo", "Cy", "Dot", "Ezra", "Flo"]
DENSE_LAST = ["Adams", "Baker", "Chen", "Diaz", "Evans", "Fox", "Gray", "Hill"]


def uid(key: str) -> str:
    u = uuid.uuid5(NS, key).hex
    # force RFC-4122 v4 shape (version nibble 4, variant 8-b) like src/db/uid.ts
    u = u[:12] + "4" + u[13:16] + "89ab"[int(u[16], 16) % 4] + u[17:]
    return f"{u[:8]}-{u[8:12]}-{u[12:16]}-{u[16:20]}-{u[20:]}"


def ts(d: dt.datetime) -> str:
    return d.strftime("%Y-%m-%d %H:%M:%S")


def adb(serial, *args, stdin=None, check=True):
    return subprocess.run([ADB, "-s", serial, *args], input=stdin,
                          capture_output=True, check=check)


def resolve_serial(explicit):
    if explicit:
        return explicit
    out = subprocess.run([ADB, "devices"], capture_output=True, text=True).stdout
    devs = [l.split()[0] for l in out.splitlines()[1:] if l.strip().endswith("device")]
    if len(devs) != 1:
        sys.exit(f"need exactly one adb device, found {devs}")
    return devs[0]


def make_avatar(path, seed):
    from PIL import Image, ImageDraw  # synthetic abstract art, no faces
    rnd = random.Random(seed)
    size = 512
    img = Image.new("RGB", (size, size))
    a = [rnd.randint(30, 220) for _ in range(3)]
    b = [rnd.randint(30, 220) for _ in range(3)]
    px = img.load()
    for y in range(size):
        t = y / size
        row = tuple(int(a[i] * (1 - t) + b[i] * t) for i in range(3))
        for x in range(size):
            px[x, y] = row
    d = ImageDraw.Draw(img)
    for _ in range(6):
        r = rnd.randint(40, 160)
        cx, cy = rnd.randint(0, size), rnd.randint(0, size)
        fill = tuple(rnd.randint(40, 255) for _ in range(3))
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=fill)
    img.save(path, "JPEG", quality=88)


def seed(conn, now, with_photos, satellites_flag):
    c = conn.cursor()
    uv = c.execute("PRAGMA user_version").fetchone()[0]
    if uv < EXPECTED_MIN_USER_VERSION:
        sys.exit(f"DB user_version {uv} < {EXPECTED_MIN_USER_VERSION}; launch the app once first")
    c.execute("PRAGMA foreign_keys=ON")
    n = ts(now)
    # ---- wipe (Lab A package holds synthetic data only) ----
    c.execute("DELETE FROM system_overrides")
    c.execute("DELETE FROM system_prefs")
    c.execute("DELETE FROM systems")  # cascades system_rules
    c.execute("DELETE FROM relationships")
    c.execute("DELETE FROM interactions")
    c.execute("DELETE FROM contacts")
    c.execute("DELETE FROM categories WHERE id > 4")
    c.execute("UPDATE app_settings SET orrery_last_system='builtin:all-contacts'")

    # ---- dense category ----
    c.execute("INSERT INTO categories (uid,name,display_order,created_at,modified_at) VALUES (?,?,?,?,?)",
              (uid("cat:dense"), "Lab Dense", 4, n, n))
    dense_cat = c.lastrowid

    rnd = random.Random(42)
    photos = []  # (contact_id, seedkey)
    contacts = []  # (id, interval, days_since, rarely)

    def add_contact(key, name, cat_id, interval, days_since, fav, rarely, photo, created_offset):
        created = ts(now - dt.timedelta(days=400 - created_offset))
        c.execute(
            "INSERT INTO contacts (uid,name,category_id,interval_days,tracking_enabled,favourite_rank,"
            "rarely_responds,created_at,modified_at) VALUES (?,?,?,?,1,?,?,?,?)",
            (uid(key), name, cat_id, interval, fav, rarely, created, n))
        cid = c.lastrowid
        if photo:
            rel = f"avatars/contact-{cid}.jpg"
            c.execute("UPDATE contacts SET photo=? WHERE id=?", (rel, cid))
            photos.append((cid, key))
        if days_since is not None:
            # a few older interactions plus the most recent one at days_since
            count = rnd.randint(2, 6)
            for k in range(count):
                back = days_since + k * max(1, interval // 2) + (0 if k == 0 else rnd.randint(0, 5))
                occ = now - dt.timedelta(days=back, hours=rnd.randint(0, 6))
                c.execute(
                    "INSERT INTO interactions (uid,contact_id,occurred_at,recorded_at,channel,direction,"
                    "connected,quality,note,source,modified_at,allow_ai) VALUES (?,?,?,?,?,?,?,?,?,?,?,0)",
                    (uid(f"{key}:int:{k}"), cid, ts(occ), ts(occ),
                     rnd.choice(["Message", "Call", "In Person"]), "outbound",
                     1, rnd.choice(["Positive", "Neutral", None]), None, "manual", n))
        contacts.append(cid)
        return cid

    core_ids = {}
    for i, (name, cat, interval, since, fav, rarely, photo, sats) in enumerate(CORE):
        cid = add_contact(f"core:{i}", name, CAT[cat], interval, since, fav, rarely, photo, i)
        core_ids[name] = cid
        for j, (pname, rel) in enumerate(sats):
            c.execute(
                "INSERT INTO relationships (uid,contact_id,person_name,relation_type,linked_contact_id,note,"
                "pinned,hidden,created_at,modified_at) VALUES (?,?,?,?,NULL,NULL,0,NULL,?,?)",
                (uid(f"core:{i}:rel:{j}"), cid, pname, rel, n, n))

    for i in range(32):
        name = f"{DENSE_FIRST[i]} {DENSE_LAST[i % len(DENSE_LAST)]}"
        interval = rnd.choice([7, 14, 21, 30, 45, 60, 90])
        # spread progress 0.05 .. 1.8 (stable/wobble/decay mix)
        since = max(0, int(interval * rnd.uniform(0.05, 1.8)))
        add_contact(f"dense:{i}", name, dense_cat, interval, since, None, 0, i % 3 == 0, 20 + i)

    # ---- recency recompute: exact statement from src/db/recency-dao.ts ----
    for cid in contacts:
        c.execute(
            """UPDATE contacts
                  SET last_contact = (
                        SELECT MAX(i.occurred_at)
                          FROM interactions i
                         WHERE i.contact_id = contacts.id
                           AND (contacts.rarely_responds = 0 OR i.connected = 1)
                      ),
                      modified_at = ?
                WHERE id = ?""", (n, cid))

    # ---- custom System ----
    c.execute("INSERT INTO systems (uid,name,created_at,modified_at) VALUES (?,?,?,?)",
              (uid("sys:inner"), "Lab Inner Circle", n, n))
    sys_id = c.lastrowid
    c.execute("INSERT INTO system_rules (uid,system_id,family,value,created_at) VALUES (?,?,?,?,?)",
              (uid("sys:inner:rule:fav"), sys_id, "favorite", "on", n))
    c.execute("INSERT INTO system_overrides (uid,system_ref,contact_id,mode,created_at) VALUES (?,?,?,?,?)",
              (uid("sys:inner:ovr:clara"), f"custom:{uid('sys:inner')}", core_ids["Clara Ruiz"], "include", n))

    if satellites_flag is not None:
        c.execute("UPDATE app_settings SET orrery_satellites_enabled=?", (int(satellites_flag),))
    conn.commit()
    return photos


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--serial")
    ap.add_argument("--no-photos", action="store_true")
    ap.add_argument("--satellites", type=int, choices=[0, 1])
    args = ap.parse_args()
    s = resolve_serial(args.serial)
    work = tempfile.mkdtemp(prefix="laba-seed-")
    try:
        adb(s, "shell", "am", "force-stop", PKG)
        for f in ("orbit.db", "orbit.db-wal", "orbit.db-shm"):
            r = adb(s, "exec-out", "run-as", PKG, "cat", f"{DB_DIR}/{f}", check=False)
            if r.returncode == 0 and r.stdout:
                open(os.path.join(work, f), "wb").write(r.stdout)
        dbp = os.path.join(work, "orbit.db")
        if not os.path.exists(dbp):
            sys.exit("no orbit.db in Lab A package — launch the app once first")
        conn = sqlite3.connect(dbp)
        photos = seed(conn, dt.datetime.now(), not args.no_photos, args.satellites)
        conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
        conn.execute("PRAGMA journal_mode=DELETE")  # fold WAL into the main file
        conn.close()
        # push back; remove stale device WAL/SHM so they cannot be replayed
        data = open(dbp, "rb").read()
        adb(s, "shell", f"run-as {PKG} sh -c 'rm -f {DB_DIR}/orbit.db-wal {DB_DIR}/orbit.db-shm; cat > {DB_DIR}/orbit.db'",
            stdin=data)
        r = adb(s, "shell", f"run-as {PKG} ls -l {DB_DIR}")
        print(r.stdout.decode().strip())
        if not args.no_photos:
            adb(s, "shell", f"run-as {PKG} sh -c 'rm -rf files/avatars; mkdir -p files/avatars'")
            for cid, key in photos:
                p = os.path.join(work, f"contact-{cid}.jpg")
                make_avatar(p, key)
                adb(s, "shell", f"run-as {PKG} sh -c 'cat > files/avatars/contact-{cid}.jpg'",
                    stdin=open(p, "rb").read())
            print(f"pushed {len(photos)} avatars")
        v = sqlite3.connect(dbp)
        q = lambda sql: v.execute(sql).fetchone()[0]
        print("contacts", q("select count(*) from contacts"),
              "orbiting", q("select count(*) from contacts where last_contact is not null and tracking_enabled=1 and archived_at is null"),
              "interactions", q("select count(*) from interactions"),
              "satellites", q("select count(*) from relationships"),
              "categories", q("select count(*) from categories"),
              "custom_systems", q("select count(*) from systems"))
        v.close()
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    main()
