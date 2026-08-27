# =====================================================
#  LyricsRPC - Pelny Instalator
# =====================================================

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$Pack = (Get-Item $PSScriptRoot).Parent.FullName

# Sprawdzenie uprawnien administratora i automatyczna prosba UAC
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Prosba o uprawnienia administratora..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

$LogDir = Join-Path $Pack "_logs"
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Force $LogDir | Out-Null }
$LogFile = Join-Path $LogDir ("install_" + (Get-Date -Format "yyyyMMdd_HHmmss") + ".log")

function Log($text) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$timestamp] $text"
    $line | Out-File -FilePath $LogFile -Append -Encoding UTF8
}

Log "=== ROZPOCZECIE INSTALACJI LYRICSRPC ==="
Log "Katalog paczki: $Pack"

function Write-Step($n, $total, $msg) {
    Write-Host ""
    Write-Host "  [$n/$total] $msg" -ForegroundColor Cyan
    Write-Host "  $("-" * 50)" -ForegroundColor DarkGray
    Log "KROK [$n/$total]: $msg"
}
function Write-OK($msg)   { 
    Write-Host "    [OK] $msg" -ForegroundColor Green 
    Log "[OK] $msg"
}
function Write-Warn($msg) { 
    Write-Host "    [!!] $msg" -ForegroundColor Yellow 
    Log "[OSTRZEZENIE] $msg"
}
function Write-Err($msg)  { 
    Write-Host "    [BLAD] $msg" -ForegroundColor Red 
    Log "[BLAD] $msg"
}
function Write-Info($msg) { 
    Write-Host "    --> $msg" -ForegroundColor Gray 
    Log "[INFO] $msg"
}

function Exec-Log($cmdBlock, $description = "") {
    if ($description) { Log "[EXEC] $description" }
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & $cmdBlock 2>&1 | ForEach-Object {
            $text = $_.ToString().Trim()
            if ($text -eq "") { return }
            if ($_ -is [System.Management.Automation.ErrorRecord]) {
                $msg = $_.Exception.Message.Trim()
                # Szum pnpm/npm - wypisuje opis komendy i notice'y na stderr, to nie są błędy
                if ($msg -match '^\$\s' -or $msg -match '^npm notice' -or $msg -match '^\[WARN\]') {
                    Write-Host "      $msg" -ForegroundColor DarkGray
                    Log "  [OUTPUT] $msg"
                } else {
                    Write-Host "      $msg" -ForegroundColor Red
                    Log "  [BLAD-EXEC] $msg"
                }
            } else {
                Write-Host "      $text" -ForegroundColor DarkGray
                Log "  [OUTPUT] $text"
            }
        }
    } catch {
        $errMsg = $_.Exception.Message
        Write-Host "      $errMsg" -ForegroundColor Red
        Log "  [BLAD-EXEC] $errMsg"
    } finally {
        $ErrorActionPreference = $prevEAP
    }
}

function Refresh-Path {
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path","User")
}

function Test-Cmd($cmd) {
    return [bool](Get-Command $cmd -ErrorAction SilentlyContinue)
}

function Install-Via-Winget($id, $name) {
    Write-Info "Instaluje $name przez winget..."
    try {
        winget install --id $id --silent --accept-package-agreements --accept-source-agreements 2>&1 | Out-Null
        Refresh-Path
        return $true
    } catch {
        return $false
    }
}

# ─────────────────────────────────────────────────────
Clear-Host
Write-Host ""
Write-Host "  =====================================================" -ForegroundColor Cyan
Write-Host "   LyricsRPC - Pelny Instalator                       " -ForegroundColor White
Write-Host "   Spotify + Spicetify + Serwer + Vencord + Discord   " -ForegroundColor Gray
Write-Host "  =====================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Katalog paczki: $Pack" -ForegroundColor DarkGray
Write-Host ""

$totalSteps = 9

# ─────────────────────────────────────────────────────
# KROK 1 — Node.js
# ─────────────────────────────────────────────────────
Write-Step 1 $totalSteps "Node.js"
if (Test-Cmd node) {
    Write-OK "Node.js juz zainstalowany: $(node -v)"
} else {
    $ok = $false
    if (Test-Cmd winget) { $ok = Install-Via-Winget "OpenJS.NodeJS.LTS" "Node.js LTS" }

    if (-not $ok) {
        Write-Info "Pobieranie Node.js LTS..."
        try {
            $index = Invoke-RestMethod "https://nodejs.org/dist/index.json"
            $lts   = ($index | Where-Object { $_.lts } | Select-Object -First 1).version
            $msi   = "$env:TEMP\nodejs-lts.msi"
            Invoke-WebRequest "https://nodejs.org/dist/$lts/node-$lts-x64.msi" -OutFile $msi
            Start-Process msiexec -ArgumentList "/i `"$msi`" /quiet /norestart ADDLOCAL=ALL" -Wait
            Refresh-Path
        } catch {
            Write-Err "Nie udalo sie pobrac Node.js. Zainstaluj recznie: https://nodejs.org/"
            Read-Host "Nacisnij Enter aby kontynuowac mimo to..."
        }
    }

    if (Test-Cmd node) { Write-OK "Node.js zainstalowany: $(node -v)" }
    else { Write-Err "Node.js nadal brak - instalacja moze sie nie powiesc!"; Start-Sleep 3 }
}

# ─────────────────────────────────────────────────────
# KROK 2 — Git
# ─────────────────────────────────────────────────────
Write-Step 2 $totalSteps "Git"
if (Test-Cmd git) {
    Write-OK "Git juz zainstalowany: $(git --version)"
} else {
    $ok = $false
    if (Test-Cmd winget) { $ok = Install-Via-Winget "Git.Git" "Git" }

    if (-not $ok) {
        Write-Info "Pobieranie Git for Windows..."
        try {
            $gitApi  = Invoke-RestMethod "https://api.github.com/repos/git-for-windows/git/releases/latest"
            $gitUrl  = ($gitApi.assets | Where-Object { $_.name -match "64-bit\.exe$" } | Select-Object -First 1).browser_download_url
            $gitExe  = "$env:TEMP\git-installer.exe"
            Invoke-WebRequest $gitUrl -OutFile $gitExe
            Start-Process $gitExe -ArgumentList "/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /NOCANCEL" -Wait
            Refresh-Path
        } catch {
            Write-Err "Nie udalo sie pobrac Git. Zainstaluj recznie: https://git-scm.com/"
            Read-Host "Nacisnij Enter aby kontynuowac..."
        }
    }

    if (Test-Cmd git) { Write-OK "Git zainstalowany: $(git --version)" }
    else { Write-Warn "Git brak - build Vencorda moze sie nie udac" }
}

# ─────────────────────────────────────────────────────
# KROK 3 — Spotify (Instalowany w kontekście zwykłego użytkownika)
# ─────────────────────────────────────────────────────
Write-Step 3 $totalSteps "Spotify"
$spotifyExe = "$env:APPDATA\Spotify\Spotify.exe"
if (Test-Path $spotifyExe) {
    Write-OK "Spotify juz zainstalowany"
} else {
    Write-Info "Pobieranie instalatora Spotify (Desktop)..."
    $setup = "$env:TEMP\SpotifyFullSetup.exe"
    try {
        Invoke-WebRequest -Uri "https://download.scdn.co/SpotifyFullSetup.exe" -OutFile $setup -UserAgent "Mozilla/5.0"
    } catch {
        $setup = "$env:TEMP\SpotifySetup.exe"
        Invoke-WebRequest -Uri "https://download.scdn.co/SpotifySetup.exe" -OutFile $setup -UserAgent "Mozilla/5.0"
    }

    Write-Info "Uruchamianie instalatora Spotify jako zwykly uzytkownik..."
    Start-Process explorer.exe -ArgumentList "`"$setup`""

    $maxWait = 60
    $waited = 0
    while (-not (Test-Path $spotifyExe) -and $waited -lt $maxWait) {
        Start-Sleep -Seconds 2
        $waited += 2
    }

    if (Test-Path $spotifyExe) { 
        Write-OK "Spotify zainstalowany!" 
    } else { 
        Write-Warn "Jesli instalator Spotify jeszcze sie instaluje, poczekaj az sie zakonczy." 
    }
}

# ─────────────────────────────────────────────────────
# KROK 4 — Discord
# ─────────────────────────────────────────────────────
Write-Step 4 $totalSteps "Discord"
$discordExe = "$env:LOCALAPPDATA\Discord\Update.exe"
if (Test-Path $discordExe) {
    Write-OK "Discord juz zainstalowany"
} else {
    $ok = $false
    if (Test-Cmd winget) { $ok = Install-Via-Winget "Discord.Discord" "Discord" }

    if (-not $ok) {
        Write-Info "Pobieranie Discord..."
        try {
            $setup = "$env:TEMP\DiscordSetup.exe"
            Invoke-WebRequest "https://discord.com/api/downloads/distributions/app/installers/latest?channel=stable&platform=win&arch=x86" -OutFile $setup
            Start-Process $setup -ArgumentList "-s" -Wait
        } catch {
            Write-Err "Nie udalo sie pobrac Discord. Zainstaluj recznie: https://discord.com/download"
            Read-Host "Nacisnij Enter..."
        }
    }

    if (Test-Path $discordExe) { Write-OK "Discord zainstalowany" }
    else { Write-Warn "Discord moze byc zainstalowany - sprawdz recznie" }
}

# ─────────────────────────────────────────────────────
# KROK 5 — pnpm
# ─────────────────────────────────────────────────────
Write-Step 5 $totalSteps "pnpm"
if (-not (Test-Cmd pnpm)) {
    Write-Info "Instaluje pnpm..."
    Exec-Log { npm install -g pnpm } "Instalacja pnpm"
    Refresh-Path
}
if (Test-Cmd pnpm) { Write-OK "pnpm $(pnpm -v)" }
else { Write-Err "pnpm nie zainstalowany!"; Read-Host; exit 1 }

# ─────────────────────────────────────────────────────
# KROK 6 — Spicetify + wtyczki (Uruchamiane przez oficjalny skrypt bez admina)
# ─────────────────────────────────────────────────────
Write-Step 6 $totalSteps "Spicetify + wtyczki"

# 1. Zamknij Spotify przed modyfikacja
Stop-Process -Name "Spotify" -Force -ErrorAction SilentlyContinue

# 2. Skopiuj rozszerzenia do folderow Spicetify
$spicExt1 = "$env:APPDATA\spicetify\Extensions"
$spicExt2 = "$env:USERPROFILE\.spicetify\Extensions"

foreach ($dir in @($spicExt1, $spicExt2)) {
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }
    Copy-Item "$Pack\spicetify\Extensions\lucid-lyrics-customrpc.js"  $dir -Force
}
Write-OK "Skopiowano wtyczki do Extensions"

# 3. Instalacja oficjalnego Spicetify + Marketplace inline
Write-Info "Pobieranie i instalowanie oficjalnego Spicetify..."

$spicetifyDir = "$env:LOCALAPPDATA\spicetify"
$spicExe = "$spicetifyDir\spicetify.exe"

# Pobranie i instalacja Spicetify CLI jeśli brak
if (-not (Test-Path $spicExe)) {
    Exec-Log {
        $rel = Invoke-RestMethod -Uri "https://api.github.com/repos/spicetify/cli/releases/latest"
        $zipAsset = $rel.assets | Where-Object { $_.name -match "windows-x64\.zip$" } | Select-Object -First 1
        $zipFile = "$env:TEMP\spicetify-cli.zip"
        Invoke-WebRequest -Uri $zipAsset.browser_download_url -OutFile $zipFile
        if (-not (Test-Path $spicetifyDir)) { New-Item -ItemType Directory -Force -Path $spicetifyDir | Out-Null }
        Expand-Archive -Path $zipFile -DestinationPath $spicetifyDir -Force
    } "Pobieranie Spicetify CLI"
}

# Dodaj spicetify do PATH użytkownika (tak jak oficjalny install.ps1)
$userPath = [Environment]::GetEnvironmentVariable("PATH", "User")
if ($userPath -notlike "*$spicetifyDir*") {
    [Environment]::SetEnvironmentVariable("PATH", "$userPath;$spicetifyDir", "User")
    Write-Info "Dodano $spicetifyDir do PATH uzytkownika"
    Log "[INFO] Dodano spicetify do PATH uzytkownika"
}

# Instalacja Marketplace (CustomApps + Theme placeholder do zmiany motywów)
$marketAppPath = "$env:APPDATA\spicetify\CustomApps\marketplace"
$marketThemePath = "$env:APPDATA\spicetify\Themes\marketplace"

Exec-Log {
    Remove-Item -Path $marketAppPath, $marketThemePath -Recurse -Force -ErrorAction SilentlyContinue | Out-Null
    New-Item -Path $marketAppPath, $marketThemePath -ItemType Directory -Force | Out-Null

    # Pobranie plików Marketplace
    $mZip = "$env:TEMP\marketplace.zip"
    Invoke-WebRequest -Uri "https://github.com/spicetify/marketplace/releases/latest/download/marketplace.zip" -OutFile $mZip
    Expand-Archive -Path $mZip -DestinationPath $marketAppPath -Force
    if (Test-Path "$marketAppPath\marketplace-dist") {
        Move-Item -Path "$marketAppPath\marketplace-dist\*" -Destination $marketAppPath -Force
        Remove-Item -Path "$marketAppPath\marketplace-dist" -Recurse -Force
    }
    Remove-Item -Path $mZip -Force -ErrorAction SilentlyContinue

    # Pobranie color.ini dla placeholder theme (niezbędne do instalowania i zmiany motywów w Marketplace!)
    Invoke-WebRequest -Uri "https://raw.githubusercontent.com/spicetify/spicetify-marketplace/main/resources/color.ini" -OutFile "$marketThemePath\color.ini"
} "Instalacja Marketplace + Themes placeholder"

Refresh-Path
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User") + ";$spicetifyDir"

# 4. Zastosowanie wtyczek i backup apply
Write-Info "Konfigurowanie wtyczek i aplikowanie zmian..."
Exec-Log { & $spicExe --bypass-admin backup apply } "Spicetify backup apply"
Exec-Log { & $spicExe --bypass-admin config custom_apps marketplace } "Spicetify config custom_apps marketplace"
Exec-Log { & $spicExe --bypass-admin config current_theme marketplace } "Spicetify config current_theme marketplace"
Exec-Log { & $spicExe --bypass-admin config inject_css 1 replace_colors 1 } "Spicetify config inject_css 1 replace_colors 1"
Exec-Log { & $spicExe --bypass-admin config extensions lucid-lyrics-customrpc.js } "Spicetify config extensions: lucid-lyrics-customrpc.js"
Exec-Log { & $spicExe --bypass-admin apply } "Spicetify apply"

Write-OK "Spicetify zainstalowany z Marketplace (w pelni obslugujacym motywy) i skonfigurowany!"

# ─────────────────────────────────────────────────────
# KROK 7 — Serwer lyrics-status + autostart
# ─────────────────────────────────────────────────────
Write-Step 7 $totalSteps "Serwer lyrics-status + autostart"

$serverDest = "$env:APPDATA\lyrics-status"

# Zabij node.exe ktory moze uzywac starego folderu serwera
Write-Info "Zatrzymywanie starego serwera (node.exe)..."
Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
    try { $_.MainModule.FileName -like "*\node*" } catch { $true }
} | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 800

if (Test-Path $serverDest) {
    Remove-Item $serverDest -Recurse -Force -ErrorAction SilentlyContinue
    if (Test-Path $serverDest) {
        Write-Warn "Folder wciaz zajety, czekam 3s..."
        Start-Sleep 3
        Remove-Item $serverDest -Recurse -Force
    }
}
Copy-Item "$Pack\lyrics-status" $serverDest -Recurse -Force
Write-OK "Skopiowano do $serverDest"

Set-Location $serverDest
Write-Info "npm install..."
Exec-Log { npm install } "lyrics-status npm install"
Write-OK "npm install"

$startup = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"
@("start-background.vbs","lyrics-status-background.vbs","lyrics-status.vbs") | ForEach-Object {
    $old = Join-Path $startup $_
    if (Test-Path $old) { Remove-Item $old -Force -ErrorAction SilentlyContinue }
}

# Znajdz pelna sciezke do node.exe
$nodeExe = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $nodeExe) { $nodeExe = "node.exe" }

$vbsContent = "Set WshShell = CreateObject(`"WScript.Shell`")`r`n" + `
              "WshShell.CurrentDirectory = `"$serverDest`"`r`n" + `
              "WshShell.Run chr(34) & `"$nodeExe`" & chr(34) & `" `" & chr(34) & `"$serverDest\dist\index.js`" & chr(34), 0, False`r`n"

[System.IO.File]::WriteAllText("$startup\lyrics-status.vbs", $vbsContent, [System.Text.Encoding]::ASCII)
Write-OK "Autostart VBS zapisany: $startup\lyrics-status.vbs"

# Dodatkowy wpis w rejestrze Autostartu użytkownika jako gwarancja
try {
    $runKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
    $vbsPath = "$startup\lyrics-status.vbs"
    Set-ItemProperty -Path $runKey -Name "LyricsStatusServer" -Value "wscript.exe `"$vbsPath`"" -Force
    Write-OK "Wpis w rejestrze Autostartu (HKCU\...\Run) dodany"
} catch {
    Write-Warn "Nie udalo sie dodac wpisu w rejestrze Run"
}

# ─────────────────────────────────────────────────────
# KROK 8 — Vencord (build + inject)
# ─────────────────────────────────────────────────────
Write-Step 8 $totalSteps "Vencord (build + inject)"

$vencordDest = "C:\Vencord"
if (Test-Path $vencordDest) { Remove-Item $vencordDest -Recurse -Force }
Write-Info "Kopiuje pliki Vencorda..."
Copy-Item "$Pack\Vencord" $vencordDest -Recurse -Force
Write-OK "Skopiowano do $vencordDest"

Set-Location $vencordDest

Write-Info "pnpm install..."
Exec-Log { pnpm install } "Vencord pnpm install"
Write-OK "pnpm install"

Write-Info "pnpm build..."
Exec-Log { pnpm build } "Vencord pnpm build"
Write-OK "pnpm build"

Write-Info "pnpm inject (wybieranie branch: Stable)..."
Exec-Log { pnpm inject -- --install --branch stable } "Vencord pnpm inject"
Write-OK "pnpm inject - Vencord wstrzykniety do Discorda (Stable)!"

# ─────────────────────────────────────────────────────
# KROK 9 — Uruchom serwer
# ─────────────────────────────────────────────────────
Write-Step 9 $totalSteps "Uruchamianie serwera"
Start-Process node -ArgumentList "`"$serverDest\dist\index.js`"" -WorkingDirectory $serverDest -WindowStyle Hidden
Start-Sleep 2
Write-OK "Serwer dziala na http://localhost:8999"

Log "=== INSTALACJA ZAKONCZONA POMYSLNIE ==="
Log "Plik logu zapisany: $LogFile"

# ─────────────────────────────────────────────────────
# KONIEC
# ─────────────────────────────────────────────────────
Write-Host ""
Write-Host "  =====================================================" -ForegroundColor Green
Write-Host "   Instalacja zakonczona!" -ForegroundColor White
Write-Host "   Logi z instalacji zapisane w folderze: _logs\" -ForegroundColor Gray
Write-Host "" 
Write-Host "   Ostatni krok (1 minuta, recznie w Discordzie):" -ForegroundColor Yellow
Write-Host ""
Write-Host "   1. Uruchom ponownie Discorda" -ForegroundColor White
Write-Host "   2. Kliknij ikone zebatki (Ustawienia)" -ForegroundColor White
Write-Host "   3. W menu po lewej - sekcja VENCORD - kliknij Plugins" -ForegroundColor White
Write-Host "   4. Wyszukaj: LyricsRPC" -ForegroundColor White
Write-Host "   5. Wlacz przelacznik obok nazwy pluginu" -ForegroundColor White
Write-Host "" 
Write-Host "   Dashboard: http://localhost:8999" -ForegroundColor Cyan
Write-Host "  =====================================================" -ForegroundColor Green
Write-Host ""
Read-Host "Nacisnij Enter aby zamknac"
