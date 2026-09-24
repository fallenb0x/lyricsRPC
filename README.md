# LyricsRPC

Discord Rich Presence z **tekstem piosenki w czasie rzeczywistym** dla Spotify na Windows.

Aplikacja czyta aktualnie odtwarzany utwór ze Spotify przez Windows Media Session (SMTC), pobiera tekst z LrcLib lub NetEase i wysyła go do Discorda przez bezpośrednie połączenie IPC — bez żadnych wtyczek ani rozszerzeń.

---

## Wymagania

- **Windows 10/11**
- **Discord** otwarty i zalogowany
- **Spotify** (wersja desktopowa)
- [Discord Application](https://discord.com/developers/applications) z własnym **Client ID**

---

## Szybki start (gotowy .exe)

1. Pobierz `LyricsRPC.exe` z [Releases](../../releases)
2. Skopiuj `settings.example.json` do `settings.json` i uzupełnij `clientId`
3. Uruchom `LyricsRPC.exe`
4. Dashboard dostępny na `http://localhost:8999`

---

## Uruchomienie ze źródeł

Wymagany [Bun](https://bun.sh):

```bash
# Instalacja zależności
bun install

# Uruchomienie bezpośrednio
bun run src/index.ts

# Kompilacja do .exe (Windows x64)
bun run compile-bun
# → build/LyricsRPC.exe
```

---

## Konfiguracja (`settings.json`)

```json
{
  "port": 8999,
  "openBrowserOnStart": true,
  "discord": {
    "clientId": "TWÓJ_CLIENT_ID",
    "enabled": true,
    "showTimestamps": true,
    "showAlbumArt": true,
    "customLargeImage": "",
    "format": {
      "name": "{song_name} - {lyrics}",
      "details": "{song_name} - {song_author}",
      "state": "{lyrics}"
    }
  }
}
```

| Pole | Opis |
|------|------|
| `clientId` | ID aplikacji z Discord Developer Portal |
| `showTimestamps` | Pasek postępu odtwarzania w Discordzie |
| `showAlbumArt` | Okładka albumu jako duży obrazek (gdy brak `customLargeImage`) |
| `customLargeImage` | Własny URL obrazka/GIF-a zamiast okładki |
| `format.name` | Szablon linii **Name** aktywności (maks. 128 znaków) |
| `format.details` | Szablon linii **Details** |
| `format.state` | Szablon linii **State** — tu zwykle idzie tekst piosenki |

Dostępne zmienne szablonów: `{song_name}`, `{song_author}`, `{lyrics}`

---

## Struktura projektu

```
LyricsRPC/
├── src/
│   ├── index.ts                 # Główna logika aplikacji
│   ├── DiscordIpc.ts            # Bezpośrednie połączenie Discord IPC (named pipe)
│   ├── WindowsMediaWatcher.ts   # Odczyt metadanych Spotify przez SMTC (PowerShell)
│   ├── LyricsManager.ts         # Pobieranie tekstu: LrcLib → NetEase (kaskada)
│   ├── SettingsManager.ts       # Wczytywanie settings.json
│   ├── WebServer.ts             # Dashboard HTTP + WebSocket
│   └── Sources/
│       └── BaseSource.ts        # Interfejs SongLyrics
├── static/
│   ├── index.html               # Dashboard WebUI
│   └── app.js                   # Frontend dashboard
├── settings.example.json        # Przykładowa konfiguracja
├── package.json
└── tsconfig.json
```

---

## Jak to działa

```
Spotify → Windows SMTC → PowerShell → WindowsMediaWatcher
                                              ↓
                                    LyricsManager (LrcLib / NetEase)
                                              ↓
                           Pętla 80ms → dispatchDiscordActivity
                                              ↓
                                    Discord IPC (named pipe)
                                              ↓
                                     Discord Rich Presence
```

1. **WindowsMediaWatcher** odpytuje Windows Media Session co 250ms przez PowerShell i zwraca tytuł, wykonawcę, pozycję i czas trwania.
2. **LyricsManager** pobiera zsynchronizowany tekst (`.lrc`) z LrcLib, z fallbackiem na NetEase.
3. Pętla 80ms wylicza aktualny wers i wysyła aktualizację do Discorda tylko gdy tekst się zmienił.
4. **WebServer** serwuje dashboard (`http://localhost:8999`) i streamuje aktualizacje przez WebSocket.
5. Gdy aplikacja jest już uruchomiona, kolejna instancja otwiera dashboard w przeglądarce i zamyka się.

---

## Licencja

MIT
