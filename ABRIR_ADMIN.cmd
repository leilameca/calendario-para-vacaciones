@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\open.ps1" -Admin
if errorlevel 1 pause
