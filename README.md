<p align="center">
  <img src="preview.png" alt="LyricsRPC Preview" width="850">
</p>

---

# LyricsRPC

Lekka aplikacja Discord Rich Presence, która synchronizuje i wyświetla teksty piosenek ze Spotify w czasie rzeczywistym na Twoim profilu Discord.

Działa bezpośrednio przez Windows Media Session (SMTC) i Discord IPC — bez konieczności instalowania wtyczek, rozszerzeń czy modyfikowania klienta Spotify/Discord.

---

## Funkcje

- **Teksty na żywo** — Wyświetla dokładną linijkę tekstu, która jest obecnie odtwarzana na Spotify, prosto na Twoim profilu Discord.
- **Wygodna synchronizacja** — Zmiany wprowadzone w panelu WebUI są natychmiast stosowane i zapisywane.
- **Okładka lub własna grafika** — Pokazuje oryginalną okładkę ze Spotify lub Twój własny obraz/GIF z internetu.
- **Odliczanie czasu** — Pokazuje pasek postępu i czas trwania utworu na profilu Discord.
- **Lekki dla Twojego PC** — Działa cicho w tle, zużywając minimalne zasoby RAM i CPU.

---

## Wymagania

- **Windows 10/11**
- **Spotify** (wersja desktopowa)
- **Discord** (wersja desktopowa)
- Własna aplikacja w [Discord Developer Portal](https://discord.com/developers/applications) (potrzebny jest **Client ID**)
- Więcej niż 10 IQ aby uruchomić program

---

## Uruchomienie i Instalacja

### Opcja 1: Uruchomienie ze źródeł (dla programistów)

Wymagany [Bun](https://bun.sh) lub [Node.js](https://nodejs.org).

1. Sklonuj lub pobierz repozytorium:
   ```bash
   git clone https://github.com/fallenb0x/lyricsRPC.git
   cd lyricsRPC
   ```

2. Zainstaluj zależności:
   ```bash
   bun install
   ```

3. Skopiuj plik konfiguracyjny:
   ```bash
   cp settings.example.json settings.json
   ```

4. Uruchom aplikację:
   ```bash
   bun run src/index.ts
   ```

5. Opcjonalnie – skompiluj do samodzielnego pliku `.exe`:
   ```bash
   bun run compile-bun
   ```
   Skompilowany plik znajdziesz w folderze `build/LyricsRPC.exe`.

---

### Opcja 2: Gotowy plik `.exe` (Zalecane)

1. Pobierz i wypakuj **`LyricsRPC v0.2.0.zip`** z zakładki [Releases](../../releases).
2. Uruchom **`LyricsRPC.exe`**.
3. Wejdź na [Discord Developer Portal](https://discord.com/developers/applications), kliknij **New Application**, nazwij aplikację (np. "Spotify" lub "Lyrics") i skopiuj **Application ID** (Client ID).
4. Otwórz panel w przeglądarce: **[http://localhost:8999](http://localhost:8999)**, wklej skopiowany ID w polu **Discord Application Client ID** i kliknij **Zapisz ustawienia**.
5. Włącz dowolny utwór na Spotify — tekst natychmiast zacznie synchronizować się na Twoim profilu Discord!

---

## Konfiguracja i WebUI

Aplikacja posiada wbudowany panel konfiguracyjny dostępny pod adresem:
👉 **[http://localhost:8999](http://localhost:8999)**

### Plik `settings.json`

```json
{
  "port": 8999,
  "openBrowserOnStart": true,
  "minimizeToTray": true,
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

### Dostępne zmienne formatowania:
- `{song_name}` — Tytuł utworu
- `{song_author}` — Nazwa wykonawcy
- `{lyrics}` — Aktualna linijka tekstu

---

## Odinstalowywanie

Zamknij proces `LyricsRPC.exe` (lub terminal) i usuń folder z programem. Aplikacja nie instaluje sterowników ani usług systemowych.

---

## FAQ (Często zadawane pytania)

**1. Co jeśli Discord nie pokazuje aktywności?**
- Upewnij się, że Discord jest uruchomiony i zalogowany.
- Sprawdź czy w Ustawieniach Discorda ➔ **Prywatność aktywności** masz włączoną opcję wyświetlania aktualnej aktywności jako status.
- Upewnij się, że pole `clientId` w `settings.json` (lub w WebUI) zawiera prawidłowy ID Twojej aplikacji Discord.

**2. Co jeśli tekst piosenki się nie pojawia?**
- Teksty pobierane są automatycznie z baz LrcLib oraz NetEase. Jeśli dany utwór nie posiada zsynchronizowanego tekstu w bazie, wyświetli się domyślny status.
- Sprawdź dashboard pod adresem [http://localhost:8999](http://localhost:8999), aby upewnić się, że utwór jest poprawnie wykrywany.

**3. Uruchomiłem program drugi raz i nic się nie dzieje?**
- Aplikacja zabezpiecza się przed duplikatami. Przy ponownym uruchomieniu nowa instancja otwiera panel w przeglądarce i automatycznie się zamyka.
