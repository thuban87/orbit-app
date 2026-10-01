#!/usr/bin/env bash
# r2-release.sh [tag] — busy-check droid, sync source, assembleRelease (x86_64),
# pull, install -r over the seeded app, launch. RUNBOOK §4/§5/§10.
set -eu
LB=/home/bwales/projects/orbit-orrery-lab-b
T=$LB/docs/experiments/orrery-renderer/lab-b-skia-unleashed/tools
ADB="$HOME/Android/Sdk/platform-tools/adb -P 5039 -s emulator-5554"
DEST='C:\Users\bwales\projects\orbit-lab-b'
TAG=${1:-r2}
until "$T/droid-busy.sh" >/dev/null; do echo "droid busy; waiting"; sleep 120; done
cd "$LB"
tar -czf - --exclude=./node_modules --exclude=./android --exclude=./ios --exclude=./.git \
    --exclude=./.expo --exclude=./.planning --exclude=./docs . \
  | ssh -o BatchMode=yes droid "tar -xzf - -C \"$DEST\""
ssh -o BatchMode=yes droid "cd /d \"$DEST\\android\" & gradlew.bat assembleRelease -PreactNativeArchitectures=x86_64 --console=plain" > /tmp/orbit-lab-b-build-$TAG.log 2>&1 \
  || { tail -30 /tmp/orbit-lab-b-build-$TAG.log; exit 1; }
tail -3 /tmp/orbit-lab-b-build-$TAG.log
scp -q -o BatchMode=yes "droid:C:/Users/bwales/projects/orbit-lab-b/android/app/build/outputs/apk/release/app-release.apk" /tmp/orbit-lab-b-release-$TAG.apk
$ADB shell am force-stop com.bwales.orbit.labb
$ADB install -r /tmp/orbit-lab-b-release-$TAG.apk
$ADB shell monkey -p com.bwales.orbit.labb -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
echo "installed /tmp/orbit-lab-b-release-$TAG.apk"
