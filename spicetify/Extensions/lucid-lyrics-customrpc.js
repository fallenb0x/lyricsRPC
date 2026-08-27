(function lucidLyricsCustomRpcExtension() {
    const BRIDGE_ENDPOINT = "http://127.0.0.1:8999/rpc/spicetify";
    const SYNC_INTERVAL_MS = 80; // 12.5 updates per second
    const LOOKAHEAD_MS = 40; // 40ms micro-offset to compensate for HTTP/IPC dispatch latency
    const MAX_PAUSE_GAP_MS = 6000;
    const LOG_PREFIX = "[LucidLyrics-CustomRPC]";

    let updateTimer = null;
    let mutationObserver = null;
    let lastPayloadSignature = "";
    let lastSentTimestamp = 0;
    let currentSource = "none";

    let officialLyricsCache = {
        uri: "",
        loading: false,
        loaded: false,
        lines: []
    };

    function log(...args) {
        console.debug(LOG_PREFIX, ...args);
    }

    function cleanText(text) {
        return String(text || "")
            .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
            .replace(/\s+/g, " ")
            .trim();
    }

    function normalizeArtist(artist) {
        if (Array.isArray(artist)) {
            return artist.map(cleanText).filter(Boolean).join(", ");
        }
        return cleanText(artist);
    }

    function isNoise(text, track) {
        const str = cleanText(text).toLowerCase();
        if (!str) return true;
        if (/^(synced|unsynced|lyrics|tekst|karaoke|compact|fullscreen|provider|spotify|musixmatch|lrclib|loading|offline)$/i.test(str)) {
            return true;
        }
        if (/^\d+:\d{2}$/.test(str)) return true;
        if (track?.songAuthor && str === track.songAuthor.toLowerCase()) return true;
        if (track?.songName && str === track.songName.toLowerCase()) return true;
        return false;
    }

    function getTrackInfo() {
        const player = Spicetify.Player;
        if (!player) return null;

        const data = player.data || {};
        const item = data.item || data.track || {};
        const metadata = item.metadata || {};
        const uri = item.uri || metadata.uri || data.uri || "";

        const songName = cleanText(metadata.title || metadata.name || item.name || "");
        const songAuthor = normalizeArtist(metadata.artist_name || metadata.artist_names || metadata.album_artist_name || metadata.artist || "");
        const durationMs = Number(player.getDuration?.() || metadata.duration || item.duration?.milliseconds || data.duration || 0);
        const progressMs = Number(player.getProgress?.() || data.position || data.position_as_of_timestamp || 0);
        const active = !!(player.isPlaying?.() ?? data.is_playing) && !data.is_paused;

        let imageUrl = metadata.image_url || metadata.image_large_url || metadata.image_xlarge_url || item.album?.images?.[0]?.url || "";
        if (imageUrl && !imageUrl.startsWith("http")) {
            const id = imageUrl.replace(/^spotify:image:/, "");
            imageUrl = `https://i.scdn.co/image/${id}`;
        }

        return { active, uri, songName, songAuthor, durationMs, progressMs, imageUrl };
    }

    function getTrackId(uri) {
        const match = /^spotify:track:([A-Za-z0-9]+)$/.exec(uri || "");
        return match ? match[1] : "";
    }

    function parseTimestampMs(val, durationMs) {
        if (val === undefined || val === null) return 0;
        const num = Number(val);
        if (!Number.isFinite(num) || num < 0) return 0;

        if (num < 1000 && durationMs && durationMs > 10000) {
            return Math.round(num * 1000);
        }
        if (num >= 1000) {
            return Math.round(num);
        }
        return Math.round(num * 1000);
    }

    function joinSyllables(syllables) {
        let result = "";
        for (const syl of Array.isArray(syllables) ? syllables : []) {
            const part = typeof syl === "string" ? syl : (syl?.text || syl?.Text || syl?.word || "");
            result += part;
        }
        return cleanText(result);
    }

    function normalizeLucidContent(content, track) {
        const lines = [];
        for (const block of Array.isArray(content) ? content : []) {
            const startMs = parseTimestampMs(block.time ?? block.startTime ?? block.StartTime ?? block.start, track?.durationMs);
            const endMs = parseTimestampMs(block.endTime ?? block.EndTime ?? block.end, track?.durationMs);

            let text = "";
            if (Array.isArray(block.syllables || block.Syllables)) {
                text = joinSyllables(block.syllables || block.Syllables);
            }
            if (!text) {
                text = cleanText(block.text || block.Text || block.words || block.Words || "");
            }
            if (text && !isNoise(text, track)) {
                lines.push({ startMs, endMs, text });
            }
        }
        return lines.sort((a, b) => a.startMs - b.startMs);
    }

    async function fetchOfficialLyrics(track) {
        const trackId = getTrackId(track.uri);
        if (!trackId) return;

        if (officialLyricsCache.uri !== track.uri) {
            officialLyricsCache = { uri: track.uri, loading: true, loaded: false, lines: [] };
        } else if (officialLyricsCache.loading || officialLyricsCache.loaded) {
            return;
        }

        try {
            const body = await Spicetify.CosmosAsync.get(
                `https://spclient.wg.spotify.com/color-lyrics/v2/track/${trackId}?format=json&vocalRemoval=false&market=from_token`
            );
            const lines = (body?.lyrics?.lines || []).map(l => ({
                time: Number(l.startTimeMs) || 0,
                text: cleanText(l.words)
            })).filter(l => l.text);

            officialLyricsCache.lines = lines;
            officialLyricsCache.loaded = true;
        } catch (e) {
            officialLyricsCache.loaded = true;
        } finally {
            officialLyricsCache.loading = false;
        }
    }

    function readOfficialLyric(track) {
        if (officialLyricsCache.uri !== track.uri || !officialLyricsCache.lines.length) return "";
        const progress = track.progressMs + LOOKAHEAD_MS;
        let current = "";
        for (let i = 0; i < officialLyricsCache.lines.length; i++) {
            const line = officialLyricsCache.lines[i];
            const nextLine = officialLyricsCache.lines[i + 1];
            const nextStartMs = nextLine ? nextLine.time : (track.durationMs || line.time + 8000);

            if (line.time <= progress && progress < nextStartMs) {
                current = line.text;
                break;
            }
            if (line.time <= progress) {
                current = line.text;
            } else {
                break;
            }
        }
        return current;
    }

    function readLucidRpcLyric(track) {
        try {
            const rpc = window.lucidLyricsRpc;
            if (!rpc || typeof rpc.getLyrics !== "function") return "";

            const result = rpc.getLyrics();
            if (result?.status !== "success" || !result.data?.Content) return "";

            const lines = normalizeLucidContent(result.data.Content, track);
            if (!lines.length) return "";

            const progress = track.progressMs + LOOKAHEAD_MS;

            let activeLine = "";
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const nextLine = lines[i + 1];
                const nextStartMs = nextLine ? nextLine.startMs : (track.durationMs || line.startMs + 10000);

                if (line.startMs <= progress && progress < nextStartMs) {
                    activeLine = line.text;
                    break;
                }
                if (line.startMs <= progress) {
                    activeLine = line.text;
                } else {
                    break;
                }
            }
            return activeLine;
        } catch (e) {
            return "";
        }
    }

    function getCleanElementText(el) {
        const clone = el.cloneNode(true);
        clone.querySelectorAll([
            ".romanized-text",
            ".lyrics-credits",
            ".lyrics-loading",
            ".background-line",
            "[aria-hidden='true']"
        ].join(",")).forEach(n => n.remove());
        return cleanText(clone.textContent);
    }

    function isVisible(el) {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    }

    function readLucidDomLyric(track) {
        const selectors = [
            ".lucid-contents .line-lyrics .line-wrapper.active .line",
            ".lyrics-area .line-lyrics .line-wrapper.active .line",
            ".lucid-contents .syllable-lyrics .line-wrapper.active .syllable-line",
            ".lyrics-area .syllable-lyrics .line-wrapper.active .syllable-line"
        ];

        for (const sel of selectors) {
            const elements = document.querySelectorAll(sel);
            for (const el of elements) {
                if (isVisible(el)) {
                    const txt = getCleanElementText(el);
                    if (!isNoise(txt, track)) return txt;
                }
            }
        }
        return "";
    }

    // 4. Determine Active Lyric Line (STRICT PRIORITY HIERARCHY)
    async function resolveCurrentLyric(track) {
        // Priority 1: Lucid Lyrics RPC API (gdy Lucid Lyrics jest zainstalowany i aktywny)
        const lucidRpc = readLucidRpcLyric(track);
        if (lucidRpc) {
            currentSource = "lucid-lyrics-rpc";
            return lucidRpc;
        }

        // Priority 2: Lucid Lyrics DOM (aktywny wers wyświetlany na ekranie w Lucid Lyrics)
        const lucidDom = readLucidDomLyric(track);
        if (lucidDom) {
            currentSource = "lucid-lyrics-dom";
            return lucidDom;
        }

        // Priority 3: Spotify Official Color-Lyrics (TYLKO JAKO FALLBACK gdy Lucid Lyrics nie ma tekstu)
        if (officialLyricsCache.uri !== track.uri && !officialLyricsCache.loading && !officialLyricsCache.loaded) {
            await fetchOfficialLyrics(track);
        }
        const official = readOfficialLyric(track);
        if (official) {
            currentSource = "spotify-official";
            return official;
        }

        currentSource = "none";
        return "";
    }

    async function sendSyncUpdate(force = false) {
        if (!window.Spicetify?.Player) return;

        const track = getTrackInfo();
        if (!track) return;

        const lyric = await resolveCurrentLyric(track);
        const signature = JSON.stringify([track.active, track.uri, track.songName, lyric]);

        const now = Date.now();
        if (!force && signature === lastPayloadSignature && now - lastSentTimestamp < 1000) {
            return;
        }

        lastPayloadSignature = signature;
        lastSentTimestamp = now;

        const payload = {
            active: track.active,
            songName: track.songName,
            songAuthor: track.songAuthor,
            lyrics: lyric,
            hasLyrics: !!lyric,
            progressMs: track.progressMs,
            durationMs: track.durationMs,
            uri: track.uri,
            imageUrl: track.imageUrl,
            source: currentSource,
            updatedAt: now
        };

        try {
            await fetch(BRIDGE_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
        } catch (e) {}
    }

    function init() {
        if (!window.Spicetify?.Player || !window.Spicetify?.CosmosAsync) {
            setTimeout(init, 500);
            return;
        }

        if (updateTimer) clearInterval(updateTimer);
        updateTimer = setInterval(() => sendSyncUpdate(), SYNC_INTERVAL_MS);

        if (Spicetify.Player.addEventListener) {
            Spicetify.Player.addEventListener("songchange", () => {
                officialLyricsCache = { uri: "", loading: false, loaded: false, lines: [] };
                sendSyncUpdate(true);
            });
            Spicetify.Player.addEventListener("onplaypause", () => sendSyncUpdate(true));
        }

        sendSyncUpdate(true);
        log("Ready (Synchronized direct timestamping mode active).");
    }

    init();
})();
