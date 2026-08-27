@echo off
title LyricsRPC - Odinstalator
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0_installer\UNINSTALL.ps1"
