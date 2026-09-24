import express from "express";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import { SettingsManager } from "./SettingsManager";
import { DiscordIpcClient } from "./DiscordIpc";

export interface PlaybackStatePayload {
    active: boolean;
    hasLyrics: boolean;
    songName: string;
    songAuthor: string;
    lyrics: string;
    progressMs: number;
    durationMs: number;
    updatedAt: number;
    source?: string;
    uri?: string;
    imageUrl?: string;
}

export class WebServer {
    private app: express.Express;
    private server: http.Server;
    private wss: WebSocketServer;
    private wsClients: Set<WebSocket> = new Set();
    private settingsManager: SettingsManager;
    private discordIpc: DiscordIpcClient;
    private getPlaybackFn: () => PlaybackStatePayload;

    constructor(
        settingsManager: SettingsManager,
        discordIpc: DiscordIpcClient,
        getPlaybackFn: () => PlaybackStatePayload
    ) {
        this.settingsManager = settingsManager;
        this.discordIpc = discordIpc;
        this.getPlaybackFn = getPlaybackFn;

        this.app = express();
        this.app.use(express.json({ limit: "2mb" }));

        const exeDir = path.dirname(process.execPath);
        const candidates = [
            path.join(process.cwd(), "static"),
            path.join(exeDir, "static"),
            path.join(exeDir, "..", "static"),
            path.join(__dirname, "../static"),
            path.join(__dirname, "static")
        ];

        let staticDir = candidates.find(c => fs.existsSync(c)) || candidates[0];

        this.app.use(express.static(staticDir));

        this.server = http.createServer(this.app);
        this.wss = new WebSocketServer({ server: this.server, path: "/ws" });

        this.setupRoutes(staticDir);
        this.setupWebSocket();
        this.setupPeriodicBroadcast();
    }

    private setupRoutes(staticDir: string): void {
        this.app.get("/", (_req, res) => {
            res.sendFile(path.join(staticDir, "index.html"));
        });

        this.app.get("/rpc", (_req, res) => {
            const payload = this.getPlaybackFn();
            res.json({
                ...payload,
                config: {
                    discord: this.settingsManager.settings.discord,
                    version: this.settingsManager.version
                }
            });
        });

        this.app.get("/api/status", (_req, res) => {
            res.json({
                playback: this.getPlaybackFn(),
                discord: {
                    ready: this.discordIpc.isReady(),
                    connected: this.discordIpc.isConnected(),
                    user: this.discordIpc.currentUser
                },
                config: {
                    discord: this.settingsManager.settings.discord,
                    version: this.settingsManager.version
                },
                settings: this.settingsManager.settings
            });
        });

        this.app.get("/api/config", (_req, res) => {
            res.json({
                discord: this.settingsManager.settings.discord,
                version: this.settingsManager.version
            });
        });

        this.app.post("/api/config", (req, res) => {
            try {
                if (req.body?.discord) {
                    const oldClientId = this.settingsManager.settings.discord.clientId;
                    this.settingsManager.updateDiscord(req.body.discord);
                    if (req.body.discord.clientId !== undefined && req.body.discord.clientId !== oldClientId) {
                        this.discordIpc.updateClientId(req.body.discord.clientId);
                    }
                    this.broadcast({
                        type: "CONFIG_UPDATE",
                        config: {
                            discord: this.settingsManager.settings.discord,
                            version: this.settingsManager.version
                        }
                    });
                }
                res.json({
                    ok: true,
                    config: { discord: this.settingsManager.settings.discord },
                    version: this.settingsManager.version
                });
            } catch (e: any) {
                res.status(500).json({ error: e.message });
            }
        });
    }

    private setupWebSocket(): void {
        this.wss.on("connection", (ws) => {
            this.wsClients.add(ws);

            ws.on("close", () => this.wsClients.delete(ws));
            ws.on("error", () => this.wsClients.delete(ws));

            ws.on("message", (msg) => {
                try {
                    const parsed = JSON.parse(msg.toString());
                    if (parsed.discord) {
                        this.settingsManager.updateDiscord(parsed.discord);
                        this.broadcast({
                            type: "CONFIG_UPDATE",
                            config: {
                                discord: this.settingsManager.settings.discord,
                                version: this.settingsManager.version
                            }
                        });
                    }
                } catch {}
            });

            const isDiscordReady = this.discordIpc.isReady();
            const isSpicetifyReady = Date.now() - this.lastSpicetifySeen < 5000;

            ws.send(JSON.stringify({
                type: "INIT",
                playback: this.getPlaybackFn(),
                discord: {
                    ready: isDiscordReady,
                    connected: this.discordIpc.isConnected(),
                    user: this.discordIpc.currentUser
                },
                spicetify: {
                    ready: isSpicetifyReady,
                    connected: isSpicetifyReady
                },
                config: {
                    discord: this.settingsManager.settings.discord,
                    version: this.settingsManager.version
                }
            }));
        });
    }

    private setupPeriodicBroadcast(): void {
        setInterval(() => {
            if (this.wsClients.size > 0) {
                const isDiscordReady = this.discordIpc.isReady();
                const isSpicetifyReady = Date.now() - this.lastSpicetifySeen < 5000;

                this.broadcast({
                    type: "STATUS_UPDATE",
                    discord: {
                        ready: isDiscordReady,
                        connected: this.discordIpc.isConnected(),
                        user: this.discordIpc.currentUser
                    },
                    spicetify: {
                        ready: isSpicetifyReady,
                        connected: isSpicetifyReady
                    }
                });
            }
        }, 1000);
    }

    public broadcast(data: object): void {
        const msg = JSON.stringify(data);
        for (const client of this.wsClients) {
            try {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(msg);
                }
            } catch {}
        }
    }

    public start(port: number): Promise<boolean> {
        return new Promise((resolve) => {
            this.server.on("error", (err: any) => {
                if (err.code === "EADDRINUSE") {
                    console.log(`⚠️ Aplikacja LyricsRPC już działa w tle (port ${port} jest zajęty).`);
                    exec(`start http://localhost:${port}`);
                    setTimeout(() => process.exit(0), 500);
                } else {
                    console.error("Błąd serwera Web:", err);
                }
                resolve(false);
            });

            this.server.listen(port, "0.0.0.0", () => {
                console.log(`🌐 Dashboard running at http://localhost:${port}`);
                resolve(true);
            });
        });
    }
}
