#!/usr/bin/env bash
# mfocus.sh X Y outprefix : tap a body, record + logcat
ADB=~/.local/bin/adb; S=$($ADB devices | awk '$2=="device"{print $1}')
$ADB -s $S logcat -c
$ADB -s $S shell rm -f /sdcard/f.mp4
$ADB -s $S shell screenrecord --size 720x1560 --bit-rate 12000000 --time-limit 5 /sdcard/f.mp4 & REC=$!; sleep 0.8
$ADB -s $S shell input tap $1 $2
wait $REC; sleep 0.5; $ADB -s $S pull /sdcard/f.mp4 "$3.mp4" >/dev/null
$ADB -s $S logcat -d -v time | grep -E "\[probe\]|Choreographer|Davey" > "$3.log"
grep -E "probe\]|Skipped|Davey" "$3.log" | sed 's/;.*//' | cut -c1-150
