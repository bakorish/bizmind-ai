@echo off
title BizMind AI - Stop all services
echo Stopping all BizMind AI services (D:\bizmind-ai)...

REM Kill only the project's service processes (not this script itself)
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*D:\bizmind-ai*' -and $_.ProcessId -ne $PID -and $_.CommandLine -notlike '*stop.bat*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

echo All services stopped.
timeout /t 2 >nul
