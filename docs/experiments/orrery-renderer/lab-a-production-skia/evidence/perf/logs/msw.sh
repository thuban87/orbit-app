#!/usr/bin/env bash
# msw.sh "<System>" "<group>" outprefix [secs] : switch with screenrecord + logcat capture
ADB=~/.local/bin/adb; S=$($ADB devices | awk '$2=="device"{print $1}')
SP=/tmp/claude-1000/-home-bwales-projects-orbit-orrery-lab-a/44878eb8-0c41-47eb-9060-3cf82ab13373/scratchpad
$ADB -s $S logcat -c
bash $SP/sw.sh "$1" "$2" "$3.mp4" ${4:-7}
sleep 1
$ADB -s $S logcat -d -v time | grep -E "\[probe\]|Choreographer|Davey" > "$3.log"
grep -E "probe\]|Skipped" "$3.log" | sed 's/^.*\(ReactNativeJS\|Choreographer\)[^:]*: //' | head -40
