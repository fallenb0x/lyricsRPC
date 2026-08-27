<p align="center">
  <img src="preview.png" alt="LyricsRPC Preview" width="850">
</p>

# LyricsRPC
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
- **more than 10IQ to use it** (optional)

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
