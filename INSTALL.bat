@echo off
:: Sprawdzenie i automatyczne podniesienie uprawnien do Administratora (UAC)
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Prosba o uprawnienia administratora...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

:: Uruchomienie instalatora PowerShell z uprawnieniami administratora
PowerShell -NoProfile -ExecutionPolicy Bypass -File "%~dp0_installer\INSTALL.ps1"
