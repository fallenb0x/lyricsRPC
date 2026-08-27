<p align="center">
  <img src="preview.png" alt="LyricsRPC Preview" width="850">
</p>

<h3 align="center">
  <a href="#polski">🇵🇱 Polski</a>
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
