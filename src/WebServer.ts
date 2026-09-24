import express from "express";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
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

        this.discordIpc.onStatusChange((connected, ready) => {
            this.broadcast({
                type: "DISCORD_STATUS",
                discord: {
                    ready: ready,
                    connected: connected,
                    user: this.discordIpc.currentUser
                }
            });
        });
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
                    if (req.body.discord.clientId !== undefined) {
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

            ws.send(JSON.stringify({
                type: "INIT",
                playback: this.getPlaybackFn(),
                discord: {
                    ready: this.discordIpc.isReady(),
                    connected: this.discordIpc.isConnected(),
                    user: this.discordIpc.currentUser
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
                this.broadcast({
                    type: "STATUS_UPDATE",
                    discord: {
                        ready: this.discordIpc.isReady(),
                        connected: this.discordIpc.isConnected(),
                        user: this.discordIpc.currentUser
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
                    const candidates = [
                        path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Microsoft\\Edge\\Application\\msedge.exe"),
                        path.join(process.env["ProgramFiles"] || "C:\\Program Files", "Microsoft\\Edge\\Application\\msedge.exe"),
                        path.join(process.env["LOCALAPPDATA"] || "", "Microsoft\\Edge\\Application\\msedge.exe"),
                        path.join(process.env["ProgramFiles"] || "C:\\Program Files", "Google\\Chrome\\Application\\chrome.exe"),
                        path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Google\\Chrome\\Application\\chrome.exe")
                    ];
                    let found = candidates.find(c => fs.existsSync(c));
                    if (found) {
                        try {
                            spawn(found, [`--app=http://localhost:${port}`, "--window-size=1040,760"], {
                                detached: true,
                                stdio: "ignore",
                                windowsHide: true
                            }).unref();
                        } catch {
                            spawn("cmd.exe", ["/c", "start", `http://localhost:${port}`], {
                                detached: true,
                                stdio: "ignore",
                                windowsHide: true
                            }).unref();
                        }
                    } else {
                        spawn("cmd.exe", ["/c", "start", `http://localhost:${port}`], {
                            detached: true,
                            stdio: "ignore",
                            windowsHide: true
                        }).unref();
                    }
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
