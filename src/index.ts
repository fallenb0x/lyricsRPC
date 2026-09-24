import { DiscordIpcClient, DiscordActivity } from "./DiscordIpc";
import { SettingsManager } from "./SettingsManager";
import { LyricsManager } from "./LyricsManager";
import { WebServer, PlaybackStatePayload } from "./WebServer";
import { WindowsMediaWatcher, NativeMediaPlayback } from "./WindowsMediaWatcher";
import { SongLyrics } from "./Sources/BaseSource";
import { exec } from "child_process";

export class LyricsRpcApp {
    private settingsManager: SettingsManager;
    private discordIpc: DiscordIpcClient;
    private lyricsManager: LyricsManager;
    private webServer: WebServer;
    private mediaWatcher: WindowsMediaWatcher;

    private currentLyrics: SongLyrics | null = null;
    private currentLyricsKey = "";
    private currentImageUrl = "";
    private lastNativeMedia: NativeMediaPlayback | null = null;

    private currentPlayback: PlaybackStatePayload = {
        active: false,
        hasLyrics: false,
        songName: "",
        songAuthor: "",
        lyrics: "",
        progressMs: 0,
        durationMs: 0,
        updatedAt: 0,
        source: "brak",
        uri: "",
        imageUrl: ""
    };

    private lastDispatchedSignature = "";
    private updateInterval: NodeJS.Timeout | null = null;

    constructor() {
        this.settingsManager = new SettingsManager();
        this.discordIpc = new DiscordIpcClient(this.settingsManager.settings.discord.clientId);
        this.lyricsManager = new LyricsManager();
        this.mediaWatcher = new WindowsMediaWatcher();

        this.webServer = new WebServer(
            this.settingsManager,
            this.discordIpc,
            () => this.currentPlayback
        );
    }

    public async start(): Promise<void> {
        console.log("╔═══════════════════════════════════════════════════════╗");
        console.log("║           LyricsRPC Standalone Desktop App            ║");
        console.log("║       Direct Discord IPC & Native Windows Spotify     ║");
        console.log("╚═══════════════════════════════════════════════════════╝\n");

        // 1. Start WebServer first (acts as single instance lock)
        const port = this.settingsManager.settings.port || 8999;
        const serverStarted = await this.webServer.start(port);
        if (!serverStarted) {
            // Duplicate instance - already handled and exiting
            return;
        }

        // 2. Open browser on start if configured
        if (this.settingsManager.settings.openBrowserOnStart) {
            exec(`start http://localhost:${port}`);
        }

        // 3. Connect to Discord IPC
        console.log("🔌 Connecting to Discord IPC...");
        this.discordIpc.connect();

        this.discordIpc.onReady((user) => {
            console.log(`✅ Connected to Discord as: ${user?.username} (${user?.id})`);
            this.dispatchDiscordActivity(true);
        });

        this.discordIpc.onStatusChange((connected, ready) => {
            if (!connected) {
                console.log("⚠️ Discord disconnected. Retrying...");
            }
        });

        // 4. Start Native Windows Media Watcher (Detects Spotify automatically without any extensions)
        console.log("🎵 Starting native Windows Spotify media tracker...");
        this.mediaWatcher.onMediaChange((media) => this.handleNativeMediaUpdate(media));
        this.mediaWatcher.start();

        // 5. Start main 80ms sweet-spot dispatch loop
        this.startDispatchLoop();
    }


    private async handleNativeMediaUpdate(media: NativeMediaPlayback): Promise<void> {
        this.lastNativeMedia = media;

        const isPlaying = media.status === "Playing";
        const songName = media.title;
        const songAuthor = media.artist;

        if (!songName || !isPlaying) {
            this.currentPlayback = {
                active: false,
                hasLyrics: false,
                songName: "",
                songAuthor: "",
                lyrics: "",
                progressMs: 0,
                durationMs: 0,
                updatedAt: Date.now(),
                source: "brak",
                uri: "",
                imageUrl: ""
            };
            this.webServer.broadcast({
                type: "PLAYBACK_UPDATE",
                playback: this.currentPlayback
            });
            this.dispatchDiscordActivity();
            return;
        }

        const songKey = `${songName}___${songAuthor}`;
        if (songKey !== this.currentLyricsKey) {
            this.currentLyricsKey = songKey;
            this.currentLyrics = null;
            this.currentImageUrl = "";

            // Fetch lyrics from online multi-source cascade
            this.lyricsManager.getLyrics(songName, songAuthor).then((lyrics) => {
                if (this.currentLyricsKey === songKey) {
                    this.currentLyrics = lyrics;
                    this.currentPlayback.lyrics = this.findActiveLyricLine(lyrics, this.currentPlayback.progressMs);
                    this.currentPlayback.hasLyrics = !!lyrics;
                    this.webServer.broadcast({
                        type: "PLAYBACK_UPDATE",
                        playback: this.currentPlayback
                    });
                }
            });

            // Fetch album cover from iTunes API
            this.lyricsManager.getArtwork(songName, songAuthor, media.albumTitle).then((artUrl) => {
                if (this.currentLyricsKey === songKey && artUrl) {
                    this.currentImageUrl = artUrl;
                    this.currentPlayback.imageUrl = artUrl;
                    this.webServer.broadcast({
                        type: "PLAYBACK_UPDATE",
                        playback: this.currentPlayback
                    });
                    this.dispatchDiscordActivity(true);
                }
            });
        }

        // Calculate current active lyric line based on progressMs
        const currentLyricLine = this.findActiveLyricLine(this.currentLyrics, media.positionMs);

        this.currentPlayback = {
            active: isPlaying,
            hasLyrics: !!this.currentLyrics,
            songName: songName,
            songAuthor: songAuthor,
            lyrics: currentLyricLine,
            progressMs: media.positionMs,
            durationMs: media.durationMs,
            updatedAt: Date.now(),
            source: this.lyricsManager.lastFetchedFrom || "Windows Media",
            uri: "",
            imageUrl: this.currentImageUrl || ""
        };

        this.webServer.broadcast({
            type: "PLAYBACK_UPDATE",
            playback: this.currentPlayback
        });
    }

    private findActiveLyricLine(lyrics: SongLyrics | null, progressMs: number): string {
        if (!lyrics || !lyrics.lines || lyrics.lines.length === 0) return "";
        let activeLine = "";
        for (const line of lyrics.lines) {
            if (progressMs >= line.time) {
                activeLine = line.text;
            } else {
                break;
            }
        }
        return activeLine;
    }

    private formatTemplate(template: string, songName: string, songAuthor: string, lyrics: string, active: boolean): string {
        if (!template) return "";
        const effectiveLyrics = lyrics || (active ? "coś się, coś się popsuło i nie ma tekstu :3" : "");
        let res = template
            .replace(/\{song_name\}/g, songName || "")
            .replace(/\{song_author\}/g, songAuthor || "")
            .replace(/\{lyrics\}/g, effectiveLyrics);
        return res.replace(/[\s\-_–—]+$/, "").trim();
    }

    private startDispatchLoop(): void {
        this.updateInterval = setInterval(() => {
            // Smoothly advance progressMs and active lyric line between events
            if (this.lastNativeMedia && this.lastNativeMedia.status === "Playing") {
                const elapsed = Date.now() - this.lastNativeMedia.updatedAt;
                const approxPos = this.lastNativeMedia.positionMs + elapsed;
                const lyric = this.findActiveLyricLine(this.currentLyrics, approxPos);

                const lyricChanged = lyric !== this.currentPlayback.lyrics;
                this.currentPlayback.progressMs = approxPos;
                this.currentPlayback.lyrics = lyric;

                if (lyricChanged) {
                    this.webServer.broadcast({
                        type: "PLAYBACK_UPDATE",
                        playback: this.currentPlayback
                    });
                }
            }

            this.dispatchDiscordActivity();
        }, 80);
    }

    private dispatchDiscordActivity(force = false): void {
        if (!this.discordIpc.isReady()) return;

        const p = this.currentPlayback;
        const cfg = this.settingsManager.settings.discord;

        if (!cfg.enabled || !p.active || !p.songName) {
            if (this.lastDispatchedSignature !== "CLEARED") {
                this.lastDispatchedSignature = "CLEARED";
                this.discordIpc.clearActivity();
            }
            return;
        }

        const songName = p.songName;
        const songAuthor = p.songAuthor || "Nieznany wykonawca";
        const lyrics = p.lyrics || "";

        const nameStr = this.formatTemplate(cfg.format.name, songName, songAuthor, lyrics, p.active) || songName;
        const detailsStr = this.formatTemplate(cfg.format.details, songName, songAuthor, lyrics, p.active) || `${songName} - ${songAuthor}`;
        const stateStr = this.formatTemplate(cfg.format.state, songName, songAuthor, lyrics, p.active) || (lyrics || "coś się, coś się popsuło i nie ma tekstu :3");

        let largeImage = "spotify";
        if (cfg.customLargeImage && cfg.customLargeImage.trim().length > 0) {
            largeImage = cfg.customLargeImage.trim();
        } else if (cfg.showAlbumArt && p.imageUrl) {
            largeImage = p.imageUrl;
        }

        // Calculate a stable timestamp anchored to when the song actually started
        let startTs: number | undefined;
        let endTs: number | undefined;

        if (cfg.showTimestamps && p.durationMs > 0) {
            const baseTime = (this.lastNativeMedia && this.lastNativeMedia.updatedAt) ? this.lastNativeMedia.updatedAt : Date.now();
            const basePos = (this.lastNativeMedia && this.lastNativeMedia.positionMs !== undefined) ? this.lastNativeMedia.positionMs : (p.progressMs || 0);
            startTs = Math.floor(baseTime - basePos);
            endTs = Math.floor(startTs + p.durationMs);
        }

        // Signature depends only on text, cover, and song identity - NOT on ticking time!
        const signature = JSON.stringify([
            nameStr,
            detailsStr,
            stateStr,
            largeImage,
            cfg.showTimestamps,
            songName,
            songAuthor
        ]);

        if (!force && signature === this.lastDispatchedSignature) {
            return;
        }

        this.lastDispatchedSignature = signature;

        const activity: DiscordActivity = {
            type: 2, // 2 = LISTENING ("Słucha")
            name: nameStr.slice(0, 128),
            details: detailsStr.slice(0, 128),
            state: stateStr.slice(0, 128),
            assets: {
                large_image: largeImage
            }
        };

        if (startTs && endTs) {
            activity.timestamps = {
                start: startTs,
                end: endTs
            };
        }

        this.discordIpc.setActivity(activity);
    }
}

process.on("uncaughtException", (err) => {
    console.error("⚠️ Nieobsłużony błąd (uncaughtException):", err);
});

process.on("unhandledRejection", (reason) => {
    console.error("⚠️ Nieobsłużone odrzucenie obietnicy (unhandledRejection):", reason);
});

// Entrypoint
const app = new LyricsRpcApp();
app.start().catch((err) => {
    console.error("Fatal error starting LyricsRPC:", err);
});
