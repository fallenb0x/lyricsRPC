"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = startServer;
const express_1 = __importDefault(require("express"));
const node_fs_1 = require("node:fs");
const node_http_1 = require("node:http");
const ws_1 = require("ws");
const node_path_1 = require("node:path");
const Settings_1 = require("../Settings");
const SpotifyService_1 = require("../SpotifyService");
let spicetifyRpcPayload = null;
const SPICETIFY_LYRICS_CACHE_DIR = (0, node_path_1.join)(process.env.APPDATA || (0, node_path_1.join)(process.env.USERPROFILE || "", "AppData", "Roaming"), "spicetify", "LyricsStatusCache");
function crop(value, maxLength = 128) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}
function getCacheTrackId(value) {
    return crop(value, 80).replace(/[^A-Za-z0-9_-]/g, "");
}
function getLyricsCacheFilePath(trackId) {
    return (0, node_path_1.join)(SPICETIFY_LYRICS_CACHE_DIR, `${trackId}.json`);
}
function sanitizeCachedLyricsPayload(payload) {
    if (!payload || typeof payload !== "object")
        return null;
    const trackId = getCacheTrackId(payload.trackId);
    const rawLines = Array.isArray(payload.lines) ? payload.lines : [];
    const lines = rawLines
        .slice(0, 2000)
        .map((line) => ({
        time: Math.max(0, Number(line === null || line === void 0 ? void 0 : line.time) || 0),
        text: crop(line === null || line === void 0 ? void 0 : line.text, 300)
    }))
        .filter((line) => line.text)
        .sort((a, b) => a.time - b.time);
    if (!trackId || !lines.length)
        return null;
    return {
        trackId,
        uri: crop(payload.uri, 96),
        songName: crop(payload.songName),
        songAuthor: crop(payload.songAuthor),
        durationMs: Math.max(0, Number(payload.durationMs) || 0),
        provider: crop(payload.provider || payload.source || "spotify-official", 32),
        cachedAt: Math.max(0, Number(payload.cachedAt) || Date.now()),
        lines
    };
}
function writeCachedLyrics(payload) {
    return __awaiter(this, void 0, void 0, function* () {
        yield node_fs_1.promises.mkdir(SPICETIFY_LYRICS_CACHE_DIR, { recursive: true });
        const filePath = getLyricsCacheFilePath(payload.trackId);
        const tempPath = `${filePath}.tmp`;
        yield node_fs_1.promises.writeFile(tempPath, JSON.stringify(payload), "utf8");
        yield node_fs_1.promises.rename(tempPath, filePath);
    });
}
function readCachedLyrics(trackId) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield node_fs_1.promises.readFile(getLyricsCacheFilePath(trackId), "utf8");
        const parsed = JSON.parse(data);
        const payload = sanitizeCachedLyricsPayload(parsed);
        if (!payload)
            return null;
        payload.cachedAt = Math.max(0, Number(parsed.cachedAt) || payload.cachedAt);
        return payload;
    });
}
function getErrorCode(error) {
    return typeof error === "object" && error && "code" in error
        ? String(error.code || "")
        : "";
}
function getPlaybackRpcPayload(playbackState) {
    var _a;
    return {
        active: playbackState.isPlaying && !playbackState.ended && !!playbackState.songName,
        hasLyrics: playbackState.hasLyrics,
        songName: playbackState.songName,
        songAuthor: playbackState.songAuthor,
        lyrics: ((_a = playbackState.currentLine) === null || _a === void 0 ? void 0 : _a.text) || "",
        progressMs: playbackState.songProgress,
        durationMs: playbackState.songDuration,
        updatedAt: Date.now(),
        source: "lyrics-status"
    };
}
function sanitizeSpicetifyPayload(payload) {
    if (!payload || typeof payload !== "object")
        return null;
    return {
        active: !!payload.active,
        hasLyrics: !!payload.lyrics,
        songName: crop(payload.songName),
        songAuthor: crop(payload.songAuthor),
        lyrics: crop(payload.lyrics),
        progressMs: Math.max(0, Number(payload.progressMs) || 0),
        durationMs: Math.max(0, Number(payload.durationMs) || 0),
        uri: crop(payload.uri, 128),
        imageUrl: crop(payload.imageUrl, 512),
        updatedAt: Date.now(),
        source: crop(payload.source || "spicetify", 32)
    };
}
let configVersion = 1;
function startServer(playbackState) {
    const app = (0, express_1.default)();
    const httpServer = (0, node_http_1.createServer)(app);
    const wss = new ws_1.WebSocketServer({
        server: httpServer,
        path: "/ws"
    });
    app.use((req, res, next) => {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        res.setHeader("Cache-Control", "no-store");
        if (req.method === "OPTIONS")
            return res.sendStatus(204);
        next();
    });
    app.use(express_1.default.json({ limit: "1mb" }));
    app.use("/", express_1.default.static((0, node_path_1.join)(__dirname, "../../static")));
    app.get("/", (req, res) => {
        res.sendFile((0, node_path_1.join)(__dirname, "../../static/index.html"));
    });
    app.get("/callback", (req, res) => {
        if (Settings_1.Settings.credentials.useExternalAuthServer) {
            if (!req.query.refresh_token)
                return res.sendStatus(401);
            const refreshToken = req.query.refresh_token;
            console.log(refreshToken);
            Settings_1.Settings.credentials.refreshToken = refreshToken;
            Settings_1.Settings.save();
        }
        else {
            if (!req.query.code)
                return res.sendStatus(401);
            const code = req.query.code;
            Settings_1.Settings.credentials.code = code;
            SpotifyService_1.SpotifyService.exchange().then(() => Settings_1.Settings.save());
        }
        res.send("OK. You can close this page now.");
    });
    let lastDiscordSeen = 0;
    let lastSpicetifySeen = 0;
    function getActivePayload() {
        const now = Date.now();
        const spicetifyPayloadIsFresh = spicetifyRpcPayload && now - spicetifyRpcPayload.updatedAt < 5000;
        return (spicetifyPayloadIsFresh ? spicetifyRpcPayload : getPlaybackRpcPayload(playbackState)) || getPlaybackRpcPayload(playbackState);
    }
    function isDiscordOnline() {
        return Date.now() - lastDiscordSeen < 3000;
    }
    function isSpicetifyOnline() {
        return Date.now() - lastSpicetifySeen < 5000;
    }
    const wsClients = new Set();
    function broadcastWs(data) {
        const msg = JSON.stringify(data);
        for (const client of wsClients) {
            try {
                if (client.readyState === 1)
                    client.send(msg);
            }
            catch (_a) { }
        }
    }
    setInterval(() => {
        if (wsClients.size > 0) {
            const discordOnline = isDiscordOnline();
            const spicetifyOnline = isSpicetifyOnline();
            broadcastWs({
                type: "STATUS_UPDATE",
                discord: { ready: discordOnline, connected: discordOnline },
                spicetify: { ready: spicetifyOnline, connected: spicetifyOnline }
            });
        }
    }, 1000);
    app.post("/rpc/spicetify", (req, res) => {
        lastSpicetifySeen = Date.now();
        const payload = sanitizeSpicetifyPayload(req.body);
        if (!payload || (!payload.songName && payload.active))
            return res.sendStatus(400);
        spicetifyRpcPayload = payload;
        broadcastWs({ type: "PLAYBACK_UPDATE", playback: payload });
        res.sendStatus(204);
    });
    app.post("/rpc/spicetify/cache", (req, res) => __awaiter(this, void 0, void 0, function* () {
        const payload = sanitizeCachedLyricsPayload(req.body);
        if (!payload) {
            res.sendStatus(400);
            return;
        }
        try {
            yield writeCachedLyrics(payload);
            res.sendStatus(204);
        }
        catch (error) {
            console.debug("Could not write Spicetify lyrics cache", error);
            res.sendStatus(500);
        }
    }));
    app.get("/rpc/spicetify/cache/:trackId", (req, res) => __awaiter(this, void 0, void 0, function* () {
        const trackId = getCacheTrackId(req.params.trackId);
        if (!trackId) {
            res.sendStatus(400);
            return;
        }
        try {
            const payload = yield readCachedLyrics(trackId);
            if (!payload) {
                res.sendStatus(404);
                return;
            }
            res.json(payload);
        }
        catch (error) {
            if (getErrorCode(error) === "ENOENT") {
                res.sendStatus(404);
                return;
            }
            console.debug("Could not read Spicetify lyrics cache", error);
            res.sendStatus(500);
        }
    }));
    app.get("/rpc", (req, res) => {
        var _a;
        if (((_a = req.headers["user-agent"]) === null || _a === void 0 ? void 0 : _a.includes("Vencord")) || req.query.source === "vencord" || !req.headers["sec-fetch-dest"]) {
            lastDiscordSeen = Date.now();
        }
        const payload = getActivePayload();
        res.json(Object.assign(Object.assign({}, payload), { config: {
                discord: Settings_1.Settings.discord,
                version: configVersion
            } }));
    });
    app.get("/rpc/customrp", (_req, res) => {
        const p = getActivePayload();
        const match = /^spotify:track:([A-Za-z0-9]+)$/.exec(p.uri || "");
        const trackId = match ? match[1] : "";
        res.json({
            details: `${p.songName || "Brak utworu"} - ${p.songAuthor || "Brak wykonawcy"}`,
            state: p.lyrics || "🎵 Słucha muzyki",
            largeImageKey: p.imageUrl || "spotify",
            largeImageText: p.songName || "Spotify",
            smallImageKey: "spotify",
            smallImageText: "Spotify",
            button1Label: "Posłuchaj w Spotify",
            button1Url: trackId ? `https://open.spotify.com/track/${trackId}` : "https://open.spotify.com"
        });
    });
    app.get("/api/status", (_req, res) => {
        const discordOnline = isDiscordOnline();
        res.json({
            playback: getActivePayload(),
            discord: { ready: discordOnline, connected: discordOnline },
            spicetify: { ready: isSpicetifyOnline(), connected: isSpicetifyOnline() },
            config: { discord: Settings_1.Settings.discord },
            settings: Settings_1.Settings
        });
    });
    app.get("/api/config", (_req, res) => {
        res.json({ discord: Settings_1.Settings.discord, version: configVersion });
    });
    app.post("/api/config", (req, res) => {
        var _a, _b;
        try {
            configVersion++;
            if ((_a = req.body) === null || _a === void 0 ? void 0 : _a.discord) {
                Settings_1.Settings.discord = Object.assign(Object.assign(Object.assign({}, Settings_1.Settings.discord), req.body.discord), { format: Object.assign(Object.assign({}, Settings_1.Settings.discord.format), (req.body.discord.format || {})) });
                Settings_1.Settings.save();
                broadcastWs({ type: "CONFIG_UPDATE", config: { discord: Settings_1.Settings.discord, version: configVersion } });
            }
            else if ((_b = req.body) === null || _b === void 0 ? void 0 : _b.settings) {
                Object.assign(Settings_1.Settings, req.body.settings);
                Settings_1.Settings.save();
            }
            res.json({ ok: true, config: { discord: Settings_1.Settings.discord }, version: configVersion });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    wss.on("connection", (ws) => {
        wsClients.add(ws);
        ws.on("close", () => wsClients.delete(ws));
        ws.on("error", () => wsClients.delete(ws));
        ws.on("message", (data) => {
            try {
                const parsed = JSON.parse(data.toString());
                if (parsed.discord) {
                    Settings_1.Settings.discord = Object.assign(Object.assign({}, Settings_1.Settings.discord), parsed.discord);
                    Settings_1.Settings.save();
                    broadcastWs({ type: "CONFIG_UPDATE", config: { discord: Settings_1.Settings.discord } });
                }
                if (parsed.credentials || parsed.view) {
                    Settings_1.Settings.credentials = parsed.credentials || Settings_1.Settings.credentials;
                    Settings_1.Settings.view = parsed.view || Settings_1.Settings.view;
                    Settings_1.Settings.timings = parsed.timings || Settings_1.Settings.timings;
                    Settings_1.Settings.update = parsed.update || Settings_1.Settings.update;
                    Settings_1.Settings.save();
                }
            }
            catch (_a) { }
        });
        const discordOnline = isDiscordOnline();
        const initMsg = JSON.stringify({
            type: "INIT",
            playback: getActivePayload(),
            discord: { ready: discordOnline, connected: discordOnline },
            spicetify: { ready: isSpicetifyOnline(), connected: isSpicetifyOnline() },
            config: {
                discord: Settings_1.Settings.discord
            }
        });
        ws.send(initMsg);
    });
    httpServer.listen(8999, "127.0.0.1");
}
