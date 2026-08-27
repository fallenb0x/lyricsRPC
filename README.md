<p align="center">
  <img src="preview.png" alt="LyricsRPC Preview" width="850">
</p>

<h3 align="center">
  <a href="#polski">🇵🇱 Polski</a> &bull; <a href="#english">🇬🇧 English</a>  
</h3>

---

<h1 id="polski">LyricsRPC (Polski)</h1>
Lekki plugin Discord Rich Presence, który synchronizuje i wyświetla teksty piosenek ze Spotify w czasie rzeczywistym na Twoim profilu.

## Funkcje
- **Teksty na żywo** — Wyświetla dokładną linijkę tekstu, która jest obecnie odtwarzana na Spotify, prosto na Twoim profilu Discord.
- **Wygodna synchronizacja** — Cokolwiek zmienisz w panelu przeglądarki lub ustawieniach Discorda, jest natychmiast zapisywane w obu miejscach.
- **Okładka lub własna grafika** — Pokazuje oryginalną okładkę ze Spotify lub Twój własny obraz/GIF z internetu.
- **Odliczanie i Przycisk** — Pokazuje pozostały czas utworu i dodaje przycisk, dzięki któremu każdy może natychmiast odtworzyć piosenkę na Spotify.
- **Instalacja jednym kliknięciem** — Wystarczy uruchomić `INSTALL.bat`, a instalator automatycznie skonfiguruje wszystko.
- **Lekki dla Twojego PC** — Działa cicho w tle, zużywając minimalne zasoby RAM i CPU.

## Wymagania
Przed instalacją upewnij się, że masz:
- **Windows 10/11** (wymagany dla skryptów instalacyjnych)
- **więcej niż 10 IQ, żeby tego używać** (opcjonalnie)

## Instalacja 
1. **Pobierz** najnowszą wersję.
2. Uruchom `INSTALL.bat`.
3. Po zakończeniu otwórz Discorda:
   - Przejdź do **Ustawienia użytkownika** ➔ **VENCORD** ➔ **Plugins**
   - Wyszukaj **LyricsRPC** i włącz go (**ON**).
4. Odtwórz dowolny utwór na Spotify — Twój profil Discord natychmiast zacznie wyświetlać zsynchronizowany tekst w czasie rzeczywistym!

## Zmiana wyglądu
Zarządzaj formatami, przełączaj znaczniki czasu, przyciski lub własne okładki w czasie rzeczywistym za pomocą:
- WebUI - **[http://localhost:8999](http://localhost:8999)** <br>
lub
- Ustawienia w pluginie - **Ustawienia użytkownika** ➔ **VENCORD** ➔ **Plugins** ➔ **LyricsRPC**

### Dostępne zmienne:
- `{song_name}` — Tytuł utworu
- `{song_author}` — Nazwa wykonawcy
- `{lyrics}` — Aktualna linijka tekstu

## Odinstalowywanie
Aby usunąć wtyczkę, serwer działający w tle oraz wpisy w rejestrze autostartu:
- Uruchom `UNINSTALL.bat`

## Licencja
Ten projekt jest licencjonowany na warunkach licencji [GPL-3.0 License](LICENSE).

---

<h1 id="english">LyricsRPC (English)</h1>
A lightweight Discord Rich Presence plugin that synchronizes and displays real-time lyrics from Spotify directly on your profile.

## Features
- **Live Lyrics** — Displays the exact line of lyrics currently playing on Spotify, right on your Discord profile.
- **Convenient Sync** — Any changes made in the web browser panel or Discord settings are instantly saved in both places.
- **Cover Art or Custom Graphics** — Shows the original cover art from Spotify or your custom image/GIF from the internet.
- **Countdown & Button** — Shows elapsed/remaining track time and adds a button allowing anyone to play the song immediately on Spotify.
- **One-Click Installation** — Just run `INSTALL.bat` and the installer will automatically configure everything.
- **Lightweight for Your PC** — Runs quietly in the background using minimal RAM and CPU resources.

## Requirements
Before installation, make sure you have:
- **Windows 10/11** (required for installation scripts)
- **more than 10 IQ to use this** (optional)

## Installation
1. **Download** the latest release.
2. Run `INSTALL.bat`.
3. After completion, open Discord:
   - Go to **User Settings** ➔ **VENCORD** ➔ **Plugins**
   - Search for **LyricsRPC** and turn it **ON**.
4. Play any song on Spotify — your Discord profile will instantly start displaying synchronized lyrics in real time!

## Customization
Manage formats, toggle timestamps, buttons, or custom covers in real time using:
- WebUI - **[http://localhost:8999](http://localhost:8999)**<br>
or
- Plugin settings - **User Settings** ➔ **VENCORD** ➔ **Plugins** ➔ **LyricsRPC**

### Available Variables:
- `{song_name}` — Song title
- `{song_author}` — Artist name
- `{lyrics}` — Current lyric line

## Uninstallation
To remove the plugin, background server, and startup registry entries:
- Run `UNINSTALL.bat`

## License
This project is licensed under the [GPL-3.0 License](LICENSE).
