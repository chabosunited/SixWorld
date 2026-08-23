@echo off
cd /d %~dp0
echo Starting Local Server...
python -m http.server 5500
pause