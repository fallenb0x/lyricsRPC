<p align="center">
  <img src="preview.png" alt="LyricsRPC Preview" width="850">
</p>

<h3 align="center">
  <a href="#polski">🇵🇱 Polski</a> &bull; 
  <a href="#english">🇬🇧 English</a>
</h3>

---

<h1 id="polski">LyricsRPC (Polski)</h1>
Lekki plugin Discord Rich Presence, który synchronizuje i wyświetla teksty piosenek ze Spotify w czasie rzeczywistym na Twoim profilu.

## Funkcje
- **Teksty na żywo** — Wyświetla dokładną linijkę tekstu, która jest obecnie odtwarzana na Spotify, prosto na Twoim profilu Discord.
- **Wygodna synchronizacja** — Cokolwiek zmienisz w panelu przeglądarki lub ustawieniach Discorda, jest natychmiast zapisywane w obu miejscach.
- **Okładka lub własny GIF** — Pokazuje oryginalną okładkę ze Spotify lub Twój własny obraz/GIF z internetu.
- **Odliczanie i Przycisk** — Pokazuje pozostały czas utworu i dodaje przycisk, dzięki któremu każdy może natychmiast odtworzyć piosenkę na Spotify.
- **Instalacja jednym kliknięciem** — Wystarczy uruchomić `INSTALL.bat`, a instalator automatycznie skonfiguruje wszystko w tle.
- **Lekki dla Twojego PC** — Działa cicho w tle, zużywając minimalne zasoby RAM i CPU.

## Wymagania
Przed instalacją upewnij się, że masz:
- **Windows 10/11** (wymagany dla skryptów instalacyjnych)
- **więcej niż 10 IQ, żeby tego używać (opcjonalnie)**

## Instalacja 
1. **Pobierz** najnowszą wersję z zakładki Releases.
2. Uruchom `INSTALL.bat`.
3. Po zakończeniu otwórz Discorda:
   - Przejdź do **Ustawienia użytkownika** ➔ **VENCORD** ➔ **Plugins**
   - Wyszukaj **LyricsRPC** i włącz go (**ON**).
4. Odtwórz dowolny utwór na Spotify — Twój profil Discord natychmiast zacznie wyświetlać zsynchronizowany tekst w czasie rzeczywistym!

## Panel w przeglądarce (Web Dashboard)
Zarządzaj formatami, przełączaj znaczniki czasu, przyciski lub własne okładki w czasie rzeczywistym za pomocą dołączonego interfejsu:
**[http://localhost:8999](http://localhost:8999)**

### Dostępne zmienne formatowania:
- `{song_name}` — Tytuł utworu
- `{song_author}` — Nazwa wykonawcy
- `{lyrics}` — Aktualna linijka tekstu

## Odinstalowywanie
Aby usunąć wtyczkę, serwer działający w tle oraz wpisy w rejestrze autostartu:
- Uruchom `UNINSTALL.bat`

## Licencja
Ten projekt jest licencjonowany na warunkach licencji [GPL-3.0 License](LICENSE).

---
---

<h1 id="english">LyricsRPC (English)</h1>
A lightweight Discord Rich Presence plugin that syncs and displays real-time Spotify lyrics on your profile.

## Features
- **Live Lyrics** — Displays the exact line of lyrics currently playing on Spotify right on your Discord profile.
- **Convenient Sync** — Whatever you change in the browser panel or Discord settings is instantly saved in both places.
- **Cover Art or Custom GIF** — Shows the original Spotify cover art or your own custom image/GIF from the internet.
- **Timer and Button** — Shows the remaining track time and adds a button so anyone can instantly play the song on Spotify.
- **One-Click Installation** — Just run `INSTALL.bat`, and the installer automatically configures everything in the background.
- **Lightweight on Your PC** — Runs quietly in the background, consuming minimal RAM and CPU resources.

## Prerequisites
Before installing, ensure you have:
- **Windows 10/11** (required for the installation scripts)
- **more than 10IQ to use it (optional)**

## Installation 
1. **Download** the latest release from the Releases tab.
2. Run `INSTALL.bat`.
3. Once completed, open Discord:
   - Go to **User Settings** ➔ **VENCORD** ➔ **Plugins**
   - Search for **LyricsRPC** and toggle it **ON**.
4. Play any track on Spotify—your Discord profile will immediately begin displaying synced lyrics in real time!

## Web Dashboard
Manage formats, toggle timestamps, buttons, or custom cover art in real time via the included web UI:
**[http://localhost:8999](http://localhost:8999)**

### Available Format Variables:
- `{song_name}` — Track title
- `{song_author}` — Artist name
- `{lyrics}` — Current active lyric line

## Uninstall
To remove the plugin, background server, and autostart registries:
- Run `UNINSTALL.bat`

## License
This project is licensed under the [GPL-3.0 License](LICENSE).
