<p align="center">
  <img src="preview.png" alt="LyricsRPC Preview" width="850">
</p>

---

<h1 id="polski">LyricsRPC (Polski)</h1>
Lekki plugin Discord Rich Presence, który synchronizuje i wyświetla teksty piosenek ze Spotify w czasie rzeczywistym na Twoim profilu.

## Funkcje
- **Teksty na żywo** — Wyświetla dokładną linijkę tekstu, która jest obecnie odtwarzana na Spotify, prosto na Twoim profilu Discord.
- **Wygodna synchronizacja** — Cokolwiek zmienisz w panelu przeglądarki, jest natychmiast zapisywane.
- **Okładka lub własna grafika** — Pokazuje oryginalną okładkę ze Spotify lub Twój własny obraz/GIF z internetu.
- **Odliczanie czasu** — Pokazuje pozostały czas utworu na Twoim profilu Discord.
- **Lekki dla Twojego PC** — Działa cicho w tle, zużywając minimalne zasoby RAM i CPU.

## Wymagania
Przed instalacją upewnij się, że masz:
- **Windows 10/11**
- **Spotify** w wersji do pobrania ze strony spotify.com, nie microsoft store.
- **Discord** w wersji do pobrania ze strony discord.com, nie microsoft store.
- **więcej niż 10 IQ, żeby tego używać**. (opcjonalnie)

## Instalacja
1. **Pobierz** najnowszą wersję z [Releases](../../releases).
2. Skopiuj `settings.example.json` do `settings.json` i uzupełnij swój `clientId` z [Discord Developer Portal](https://discord.com/developers/applications).
3. Uruchom `LyricsRPC.exe`.
4. Odtwórz dowolny utwór na Spotify — Twój profil Discord natychmiast zacznie wyświetlać zsynchronizowany tekst w czasie rzeczywistym!

## Zmiana wyglądu
Zarządzaj formatami, przełączaj znaczniki czasu lub własne okładki w czasie rzeczywistym za pomocą WebUI:
- **[http://localhost:8999](http://localhost:8999)**

### Dostępne zmienne:
- `{song_name}` — Tytuł utworu
- `{song_author}` — Nazwa wykonawcy
- `{lyrics}` — Aktualna linijka tekstu

## Odinstalowywanie
Zamknij `LyricsRPC.exe` i usuń folder z programem. Nie zostawia żadnych śladów w systemie.

## Licencja
Ten projekt jest licencjonowany na warunkach licencji [GPL-3.0 License](LICENSE).

## FAQ (Często zadawane pytania)

**1. Co jeśli Discord nie pokazuje aktywności?**
- Upewnij się, że Discord jest otwarty i zalogowany.
- Sprawdź czy w Ustawieniach Discorda ➔ **Prywatność aktywności** masz włączone wyświetlanie aktywności.
- Sprawdź czy `clientId` w `settings.json` jest poprawny.

**2. Co jeśli tekst piosenki się nie pojawia?**
- Nie wszystkie utwory mają dostępny zsynchronizowany tekst w bazach LrcLib/NetEase.
- Sprawdź dashboard pod adresem [http://localhost:8999](http://localhost:8999) czy aplikacja wykrywa odtwarzany utwór.

**3. Uruchomiłem drugi raz i nic się nie dzieje?**
- To normalne — druga instancja automatycznie otwiera dashboard w przeglądarce i się zamyka.
