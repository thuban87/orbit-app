#!/usr/bin/env bash
# relaunch Lab A (prod-mode JS from Metro) and open the Orrery tab
ADB=~/.local/bin/adb; S=$($ADB devices | awk '$2=="device"{print $1}')
T=/home/bwales/projects/orbit-orrery-lab-a/docs/experiments/orrery-renderer/lab-a-production-skia/tools
$ADB -s $S shell am force-stop com.bwales.orbit.laba
$ADB -s $S shell input keyevent 224
$ADB -s $S shell monkey -p com.bwales.orbit.laba -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
for i in $(seq 1 60); do sleep 2; python3 $T/ui.py list 2>/dev/null | grep -q "'Orrery'" && break; done
sleep 1
python3 $T/ui.py tap "Orrery" >/dev/null
sleep ${WAIT:-8}
