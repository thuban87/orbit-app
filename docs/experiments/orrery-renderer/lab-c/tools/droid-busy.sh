#!/usr/bin/env bash
# droid-busy.sh — is any Java/Gradle/Kotlin build process active on droid?
# Exit 0 = IDLE, 1 = BUSY, 2 = probe failed (treat as busy).
# Uses PowerShell (NOT wmic — absent on droid). Lists every java/gradle/kotlin
# process with its command line and samples CPU seconds twice, 5s apart.
# Any GradleDaemon/GradleWrapperMain/GradleWorkerMain/kotlin-daemon whose CPU
# advanced by >= 0.5s in the window counts as BUSY. An idle daemon left alive
# after a finished build (CPU flat) counts as idle. A live gradle WRAPPER JVM
# (gradlew client) always means a build is in progress -> BUSY. Also BUSY on any gradlew.bat /
# cmd running gradlew.
PS='
$ErrorActionPreference="SilentlyContinue"
function snap { Get-Process | Where-Object { $_.ProcessName -match "^(java|javaw|gradle.*|kotlin.*)$" } | ForEach-Object { $c=(Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)").CommandLine; [pscustomobject]@{Id=$_.Id;Name=$_.ProcessName;Cpu=[double]$_.CPU;Cmd=$c} } }
$a=@{}; snap | ForEach-Object { $a[$_.Id]=$_ }
Start-Sleep -Seconds 5
$busy=$false
foreach($p in (snap)){
  $d = if($a.ContainsKey($p.Id)){ $p.Cpu - $a[$p.Id].Cpu } else { $p.Cpu }
  $kind = if($p.Cmd -match "GradleDaemon"){"gradle-daemon"} elseif($p.Cmd -match "GradleWrapperMain|gradle-wrapper\.jar|org\.gradle\.appname"){"gradle-wrapper"} elseif($p.Cmd -match "GradleWorkerMain|worker"){"gradle-worker"} elseif($p.Cmd -match "kotlin"){"kotlin-daemon"} else {"other-java"}
  $short = if($p.Cmd){ $p.Cmd.Substring(0,[Math]::Min(160,$p.Cmd.Length)) } else { "" }
  "{0} pid={1} kind={2} cpuDelta5s={3:N2} cmd={4}" -f $p.Name,$p.Id,$kind,$d,$short
  if($kind -eq "gradle-wrapper" -or ($kind -ne "other-java" -and $d -ge 0.5)){ $busy=$true }
}
$gw = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match "gradlew" -and $_.Name -match "cmd|gradlew" }
foreach($g in $gw){ "gradlew-launcher pid={0} cmd={1}" -f $g.ProcessId,$g.CommandLine; $busy=$true }
if($busy){"VERDICT=BUSY"} else {"VERDICT=IDLE"}
'
ENC=$(printf '%s' "$PS" | iconv -f UTF-8 -t UTF-16LE | base64 -w0)
OUT=$(ssh -o BatchMode=yes -o ConnectTimeout=15 droid "powershell -NoProfile -NonInteractive -EncodedCommand $ENC" 2>/dev/null) || { echo "probe failed"; exit 2; }
echo "$OUT" | tr -d '\r'
echo "$OUT" | grep -q "VERDICT=IDLE" && exit 0
echo "$OUT" | grep -q "VERDICT=BUSY" && exit 1
exit 2
