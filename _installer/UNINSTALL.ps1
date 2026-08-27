# =====================================================
#  LyricsRPC - Pelny Odinstalator (Uninstaller)
# =====================================================

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"
$Pack = (Get-Item $PSScriptRoot).Parent.FullName

# Sprawdzenie uprawnien administratora i automatyczna prosba UAC
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Prosba o uprawnienia administratora..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

function Write-Step($n, $total, $msg) {
    Write-Host ""
    Write-Host "  [$n/$total] $msg" -ForegroundColor Cyan
    Write-Host "  $("-" * 50)" -ForegroundColor DarkGray
}
function Write-OK($msg)   { Write-Host "    [OK] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "    [!!] $msg" -ForegroundColor Yellow }
function Write-Info($msg) { Write-Host "    --> $msg" -ForegroundColor Gray }

Clear-Host
Write-Host ""
Write-Host "  =====================================================" -ForegroundColor Red
Write-Host "   LyricsRPC - Pelny Odinstalator (Uninstaller)       " -ForegroundColor White
Write-Host "   Przywracanie Spotify, Discorda i czyszczenie       " -ForegroundColor Gray
Write-Host "  =====================================================" -ForegroundColor Red
Write-Host ""

$totalSteps = 5

# ─────────────────────────────────────────────────────
# KROK 1 — Zatrzymanie procesow serwera i aplikacji
# ─────────────────────────────────────────────────────
Write-Step 1 $totalSteps "Zatrzymywanie dzialajacych procesow"
Stop-Process -Name "Spotify" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "Discord" -Force -ErrorAction SilentlyContinue

# Zatrzymaj procesy node.js serwera lyrics-status
Get-WmiObject Win32_Process -Filter "name = 'node.exe'" -ErrorAction SilentlyContinue | ForEach-Object {
    if ($_.CommandLine -match "lyrics-status") {
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
}
Write-OK "Procesy zatrzymane"

# ─────────────────────────────────────────────────────
# KROK 2 — Przywrocenie Spotify (Spicetify restore)
# ─────────────────────────────────────────────────────
Write-Step 2 $totalSteps "Przywracanie oryginalnego Spotify"
$spicExe = "$env:LOCALAPPDATA\spicetify\spicetify.exe"
if (Test-Path $spicExe) {
    try {
        & $spicExe --bypass-admin restore
        Write-OK "Spicetify restore wykonany (Spotify przywrocone do oryginalu)"
    } catch {
        Write-Warn "Nie udalo sie wykonac spicetify restore"
    }
}

# Usun wtyczki z katalogow Spicetify
@("$env:APPDATA\spicetify\Extensions", "$env:USERPROFILE\.spicetify\Extensions") | ForEach-Object {
    if (Test-Path "$_\lucid-lyrics-customrpc.js") { Remove-Item "$_\lucid-lyrics-customrpc.js" -Force }
    if (Test-Path "$_\lyrics-status-rpc.js") { Remove-Item "$_\lyrics-status-rpc.js" -Force }
}
Write-OK "Usunieto wtyczki RPC z folderow Spicetify"

# ─────────────────────────────────────────────────────
# KROK 3 — Usuniecie serwera lyrics-status i autostartu
# ─────────────────────────────────────────────────────
Write-Step 3 $totalSteps "Usuwanie serwera lyrics-status i autostartu"
$startup = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"
@("lyrics-status.vbs", "lyrics-status-background.vbs", "start-background.vbs") | ForEach-Object {
    $file = Join-Path $startup $_
    if (Test-Path $file) { Remove-Item $file -Force -ErrorAction SilentlyContinue }
}

try {
    $runKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
    Remove-ItemProperty -Path $runKey -Name "LyricsStatusServer" -ErrorAction SilentlyContinue
} catch {}
Write-OK "Usunieto skrypty autostartu i wpisy w rejestrze"

$serverDest = "$env:APPDATA\lyrics-status"
if (Test-Path $serverDest) {
    Remove-Item $serverDest -Recurse -Force -ErrorAction SilentlyContinue
    Write-OK "Usunieto katalog $serverDest"
}

# ─────────────────────────────────────────────────────
# KROK 4 — Odinstalowanie Vencorda z Discorda
# ─────────────────────────────────────────────────────
Write-Step 4 $totalSteps "Odinstalowywanie Vencorda z Discorda"
$vencordDir = "C:\Vencord"
if (Test-Path $vencordDir) {
    Set-Location $vencordDir
    try {
        pnpm inject -- --uninstall --branch stable
        Write-OK "Vencord zostal odinstalowany z Discorda (Stable)"
    } catch {
        Write-Warn "Nie udalo sie automatycznie odinstalowac przez pnpm inject"
    }
    Set-Location $PSScriptRoot
    Remove-Item $vencordDir -Recurse -Force -ErrorAction SilentlyContinue
    Write-OK "Usunieto folder C:\Vencord"
} else {
    Write-OK "Brak folderu C:\Vencord"
}

# ─────────────────────────────────────────────────────
# KROK 5 — Opcjonalne czyszczenie Spicetify CLI
# ─────────────────────────────────────────────────────
Write-Step 5 $totalSteps "Podsumowanie i czyszczenie"
Write-OK "Wszystkie komponenty LyricsRPC i Vencorda zostaly usuniete!"

Write-Host ""
Write-Host "  =====================================================" -ForegroundColor Green
Write-Host "   Odinstalowanie zakonczone sukcesem!" -ForegroundColor White
Write-Host "   Mozesz teraz ponownie uruchomic Spotify i Discorda." -ForegroundColor Gray
Write-Host "  =====================================================" -ForegroundColor Green
Write-Host ""
Read-Host "Nacisnij Enter aby zamknac"
