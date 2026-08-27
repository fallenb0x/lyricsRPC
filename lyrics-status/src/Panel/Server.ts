import express from "express"
import { promises as fs } from "node:fs"
import { createServer } from "node:http"
import { WebSocketServer } from "ws"
import { join } from "node:path"
import { Settings } from "../Settings"
import { SpotifyService } from "../SpotifyService"
import { PlaybackState } from "../PlaybackState"

interface RpcPayload {
    active: boolean
    hasLyrics: boolean
    songName: string
    songAuthor: string
    lyrics: string
    progressMs: number
    durationMs: number
    updatedAt: number
    source?: string
    uri?: string
    imageUrl?: string
}

interface CachedLyricsLine {
    time: number
    text: string
}

interface CachedLyricsPayload {
    trackId: string
    uri: string
    songName: string
    songAuthor: string
    durationMs: number
    provider: string
    cachedAt: number
    lines: CachedLyricsLine[]
}

let spicetifyRpcPayload: RpcPayload | null = null

const SPICETIFY_LYRICS_CACHE_DIR = join(
    process.env.APPDATA || join(process.env.USERPROFILE || "", "AppData", "Roaming"),
    "spicetify",
    "LyricsStatusCache"
)

function crop(value: unknown, maxLength = 128): string {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength)
}

function getCacheTrackId(value: unknown): string {
    return crop(value, 80).replace(/[^A-Za-z0-9_-]/g, "")
}

function getLyricsCacheFilePath(trackId: string): string {
    return join(SPICETIFY_LYRICS_CACHE_DIR, `${trackId}.json`)
}

function sanitizeCachedLyricsPayload(payload: any): CachedLyricsPayload | null {
    if (!payload || typeof payload !== "object") return null

    const trackId = getCacheTrackId(payload.trackId)
    const rawLines = Array.isArray(payload.lines) ? payload.lines : []
    const lines = rawLines
        .slice(0, 2000)
        .map((line: any) => ({
            time: Math.max(0, Number(line?.time) || 0),
            text: crop(line?.text, 300)
        }))
        .filter((line: CachedLyricsLine) => line.text)
        .sort((a: CachedLyricsLine, b: CachedLyricsLine) => a.time - b.time)

    if (!trackId || !lines.length) return null

    return {
        trackId,
        uri: crop(payload.uri, 96),
        songName: crop(payload.songName),
        songAuthor: crop(payload.songAuthor),
        durationMs: Math.max(0, Number(payload.durationMs) || 0),
        provider: crop(payload.provider || payload.source || "spotify-official", 32),
        cachedAt: Math.max(0, Number(payload.cachedAt) || Date.now()),
        lines
    }
}

async function writeCachedLyrics(payload: CachedLyricsPayload): Promise<void> {
    await fs.mkdir(SPICETIFY_LYRICS_CACHE_DIR, { recursive: true })

    const filePath = getLyricsCacheFilePath(payload.trackId)
    const tempPath = `${filePath}.tmp`

    await fs.writeFile(tempPath, JSON.stringify(payload), "utf8")
    await fs.rename(tempPath, filePath)
}

async function readCachedLyrics(trackId: string): Promise<CachedLyricsPayload | null> {
    const data = await fs.readFile(getLyricsCacheFilePath(trackId), "utf8")
    const parsed = JSON.parse(data)
    const payload = sanitizeCachedLyricsPayload(parsed)

    if (!payload) return null
    payload.cachedAt = Math.max(0, Number(parsed.cachedAt) || payload.cachedAt)
    return payload
}

function getErrorCode(error: unknown): string {
    return typeof error === "object" && error && "code" in error
        ? String((error as { code?: unknown }).code || "")
        : ""
}

function getPlaybackRpcPayload(playbackState: PlaybackState): RpcPayload {
    return {
        active: playbackState.isPlaying && !playbackState.ended && !!playbackState.songName,
        hasLyrics: playbackState.hasLyrics,
        songName: playbackState.songName,
        songAuthor: playbackState.songAuthor,
        lyrics: playbackState.currentLine?.text || "",
        progressMs: playbackState.songProgress,
        durationMs: playbackState.songDuration,
        updatedAt: Date.now(),
        source: "lyrics-status"
    }
}

function sanitizeSpicetifyPayload(payload: any): RpcPayload | null {
    if (!payload || typeof payload !== "object") return null

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
    }
}

let configVersion = 1

export function startServer(playbackState: PlaybackState): void {
    const app = express()
    const httpServer = createServer(app)
    const wss = new WebSocketServer({
        server: httpServer,
        path: "/ws"
    })

    app.use((req, res, next) => {
        res.setHeader("Access-Control-Allow-Origin", "*")
        res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        res.setHeader("Access-Control-Allow-Headers", "Content-Type")
        res.setHeader("Cache-Control", "no-store")

        if (req.method === "OPTIONS") return res.sendStatus(204)

        next()
    })

    app.use(express.json({ limit: "1mb" }))

    app.use("/", express.static(join(__dirname, "../../static")))

    app.get("/", (req, res) => {
        res.sendFile(join(__dirname, "../../static/index.html"))
    })

    app.get("/callback", (req, res) => {
        if (Settings.credentials.useExternalAuthServer) {
            if (!req.query.refresh_token) return res.sendStatus(401)

            const refreshToken = req.query.refresh_token
            console.log(refreshToken)
            Settings.credentials.refreshToken = refreshToken as string
            Settings.save()
        } else {
            if (!req.query.code) return res.sendStatus(401)

            const code = req.query.code
            Settings.credentials.code = code as string
            SpotifyService.exchange().then(() => Settings.save())
        }

        res.send("OK. You can close this page now.")
    })

    const wsClients = new Set<any>()

    function getActivePayload(): RpcPayload {
        const now = Date.now()
        const spicetifyPayloadIsFresh = spicetifyRpcPayload && now - spicetifyRpcPayload.updatedAt < 5000
        return (spicetifyPayloadIsFresh ? spicetifyRpcPayload : getPlaybackRpcPayload(playbackState)) || getPlaybackRpcPayload(playbackState)
    }

    function broadcastWs(data: object) {
        const msg = JSON.stringify(data)
        for (const client of wsClients) {
            try {
                if (client.readyState === 1) client.send(msg)
            } catch {}
        }
    }

    app.post("/rpc/spicetify", (req, res) => {
        const payload = sanitizeSpicetifyPayload(req.body)
        if (!payload || (!payload.songName && payload.active)) return res.sendStatus(400)

        spicetifyRpcPayload = payload
        broadcastWs({ type: "PLAYBACK_UPDATE", playback: payload })
        res.sendStatus(204)
    })

    app.post("/rpc/spicetify/cache", async (req, res) => {
        const payload = sanitizeCachedLyricsPayload(req.body)
        if (!payload) {
            res.sendStatus(400)
            return
        }

        try {
            await writeCachedLyrics(payload)
            res.sendStatus(204)
        } catch (error) {
            console.debug("Could not write Spicetify lyrics cache", error)
            res.sendStatus(500)
        }
    })

    app.get("/rpc/spicetify/cache/:trackId", async (req, res) => {
        const trackId = getCacheTrackId(req.params.trackId)
        if (!trackId) {
            res.sendStatus(400)
            return
        }

        try {
            const payload = await readCachedLyrics(trackId)
            if (!payload) {
                res.sendStatus(404)
                return
            }

            res.json(payload)
        } catch (error) {
            if (getErrorCode(error) === "ENOENT") {
                res.sendStatus(404)
                return
            }

            console.debug("Could not read Spicetify lyrics cache", error)
            res.sendStatus(500)
        }
    })

    app.get("/rpc", (_req, res) => {
        const payload = getActivePayload()
        res.json({
            ...payload,
            config: {
                discord: Settings.discord,
                version: configVersion
            }
        })
    })

    app.get("/rpc/customrp", (_req, res) => {
        const p = getActivePayload()

        const match = /^spotify:track:([A-Za-z0-9]+)$/.exec(p.uri || "")
        const trackId = match ? match[1] : ""

        res.json({
            details: `${p.songName || "Brak utworu"} - ${p.songAuthor || "Brak wykonawcy"}`,
            state: p.lyrics || "🎵 Słucha muzyki",
            largeImageKey: p.imageUrl || "spotify",
            largeImageText: p.songName || "Spotify",
            smallImageKey: "spotify",
            smallImageText: "Spotify",
            button1Label: "Posłuchaj w Spotify",
            button1Url: trackId ? `https://open.spotify.com/track/${trackId}` : "https://open.spotify.com"
        })
    })

    app.get("/api/status", (_req, res) => {
        res.json({
            playback: getActivePayload(),
            discord: { ready: true, connected: true },
            config: { discord: Settings.discord },
            settings: Settings
        })
    })

    app.get("/api/config", (_req, res) => {
        res.json({ discord: Settings.discord, version: configVersion })
    })

    app.post("/api/config", (req, res) => {
        try {
            configVersion++
            if (req.body?.discord) {
                Settings.discord = {
                    ...Settings.discord,
                    ...req.body.discord,
                    format: {
                        ...Settings.discord.format,
                        ...(req.body.discord.format || {})
                    }
                }
                Settings.save()
                broadcastWs({ type: "CONFIG_UPDATE", config: { discord: Settings.discord, version: configVersion } })
            } else if (req.body?.settings) {
                Object.assign(Settings, req.body.settings)
                Settings.save()
            }
            res.json({ ok: true, config: { discord: Settings.discord }, version: configVersion })
        } catch (e: any) {
            res.status(500).json({ error: e.message })
        }
    })

    wss.on("connection", (ws) => {
        wsClients.add(ws)

        ws.on("close", () => wsClients.delete(ws))
        ws.on("error", () => wsClients.delete(ws))

        ws.on("message", (data) => {
            try {
                const parsed = JSON.parse(data.toString())
                if (parsed.discord) {
                    Settings.discord = { ...Settings.discord, ...parsed.discord }
                    Settings.save()
                    broadcastWs({ type: "CONFIG_UPDATE", config: { discord: Settings.discord } })
                }
                if (parsed.credentials || parsed.view) {
                    Settings.credentials = parsed.credentials || Settings.credentials
                    Settings.view = parsed.view || Settings.view
                    Settings.timings = parsed.timings || Settings.timings
                    Settings.update = parsed.update || Settings.update
                    Settings.save()
                }
            } catch {}
        })

        const initMsg = JSON.stringify({
            type: "INIT",
            playback: getActivePayload(),
            discord: { ready: true, connected: true },
            config: {
                discord: Settings.discord
            }
        })

        ws.send(initMsg)
    })

    httpServer.listen(8999, "127.0.0.1")
}