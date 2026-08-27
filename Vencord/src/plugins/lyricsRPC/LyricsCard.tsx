/*
 * LyricsCard — Podgląd aktywności Discord jak na localhost:8999
 * Wyświetlany w ustawieniach pluginu LyricsRPC
 */

import { React, useEffect, useState } from "@webpack/common";

import { currentPayload, LyricsPayload, settings } from ".";

const RPC_URL = "http://127.0.0.1:8999/rpc";

function formatTime(ms: number): string {
    if (!ms || ms <= 0) return "0:00";
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
}

const NO_LYRICS_TEXT = "coś się, coś się popsuło i nie ma tekstu :3";

function applyFormat(format: string, p: LyricsPayload): string {
    const effectiveLyrics = p.lyrics || (p.active ? NO_LYRICS_TEXT : "");
    let res = format
        .replace(/\{song_name\}/g, p.songName || "")
        .replace(/\{song_author\}/g, p.songAuthor || "")
        .replace(/\{lyrics\}/g, effectiveLyrics);

    res = res.replace(/[\s\-_–—]+$/, "").trim();
    return res.slice(0, 128);
}

const PLACEHOLDER_COVER = "https://via.placeholder.com/64x64/2b2d31/72767d?text=♪";

export function LyricsCard() {
    const [payload, setPayload] = useState<LyricsPayload | null>(currentPayload);
    const [progress, setProgress] = useState(0);
    const [serverConfig, setServerConfig] = useState<any>(null);
    const [serverOnline, setServerOnline] = useState(false);

    // Poll RPC endpoint for live data
    useEffect(() => {
        let alive = true;
        let interval: ReturnType<typeof setInterval>;

        const fetchData = async () => {
            try {
                const res = await fetch(RPC_URL, { cache: "no-store" });
                if (!res.ok) throw new Error();
                const data: any = await res.json();
                if (alive) {
                    setPayload(data);
                    if (data.config?.discord) setServerConfig(data.config.discord);
                    setServerOnline(true);
                }
            } catch {
                if (alive) setServerOnline(false);
            }
        };

        void fetchData();
        interval = setInterval(fetchData, 500);
        return () => { alive = false; clearInterval(interval); };
    }, []);

    // Smooth progress bar tick
    useEffect(() => {
        if (!payload?.active || !payload.durationMs) {
            setProgress(payload?.progressMs ?? 0);
            return;
        }
        setProgress(payload.progressMs);
        const start = Date.now();
        const base = payload.progressMs;
        const timer = setInterval(() => {
            const elapsed = Date.now() - start;
            const p = Math.min(base + elapsed, payload.durationMs);
            setProgress(p);
        }, 200);
        return () => clearInterval(timer);
    }, [payload?.songName, payload?.progressMs, payload?.durationMs, payload?.active]);

    const p = payload;
    const active = p?.active ?? false;
    const cover = active && p?.imageUrl ? p.imageUrl : PLACEHOLDER_COVER;
    const title = active ? p!.songName : "Brak odtwarzanego utworu";
    const artist = active ? p!.songAuthor : "Uruchom utwór w Spotify";
    const lyrics = active ? (p!.lyrics || NO_LYRICS_TEXT) : "♪ Czekam na tekst piosenki...";
    const source = p?.source ?? "brak";
    const progressPct = active && p!.durationMs > 0
        ? Math.min(100, (progress / p!.durationMs) * 100)
        : 0;

    const effSettings = settings.use([
        "formatName",
        "formatDetails",
        "formatState",
        "showTimestamp",
        "showSpotifyButton",
        "showAlbumArt",
        "customLargeImage"
    ]);

    const effFormatName = effSettings.formatName;
    const effFormatDetails = effSettings.formatDetails;
    const effFormatState = effSettings.formatState;

    const discordName = active ? applyFormat(effFormatName, p!) : "Tytuł - Tekst";
    const discordLine1 = active ? applyFormat(effFormatDetails, p!) : "Tytuł - Wykonawca";
    const discordLine2 = active ? applyFormat(effFormatState, p!) : "Aktualny wers tekstu";

    const spotifyTrackId = (() => {
        if (!p?.uri) return null;
        const m = /^spotify:track:([A-Za-z0-9]+)$/.exec(p.uri);
        return m ? m[1] : null;
    })();

    // Compute remaining time from smoothed progress
    const timeLeft = active && p!.durationMs ? p!.durationMs - progress : 0;

    const card: React.CSSProperties = {
        fontFamily: "'gg sans', 'Noto Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif",
        background: "var(--background-secondary-alt, #2b2d31)",
        borderRadius: 12,
        padding: "16px",
        marginTop: 16,
        color: "var(--text-normal, #dbdee1)",
        maxWidth: 480,
    };

    const sectionTitle: React.CSSProperties = {
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: ".05em",
        color: "var(--text-muted, #80848e)",
        marginBottom: 8,
    };

    return (
        <div style={card}>
            {/* Status bar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={sectionTitle}>📻 Odtwarzacz na żywo</span>
                <div style={{ display: "flex", gap: 6 }}>
                    <span style={{
                        padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600,
                        background: serverOnline ? "var(--green-360, #23a55a)" : "var(--red-400, #f23f43)",
                        color: "#fff"
                    }}>
                        {serverOnline ? "● Serwer: Online" : "● Serwer: Offline"}
                    </span>
                    <span style={{
                        padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600,
                        background: active ? "var(--green-360, #23a55a)" : "var(--status-warning-background, #f0b232)",
                        color: "#fff"
                    }}>
                        {active ? "▶ Odtwarza" : "⏸ Wstrzymano"}
                    </span>
                </div>
            </div>

            {/* Now Playing */}
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
                <img
                    src={cover}
                    alt="Okładka"
                    style={{ width: 64, height: 64, borderRadius: 8, objectFit: "cover", flexShrink: 0, background: "#1e1f22" }}
                    onError={e => { (e.target as HTMLImageElement).src = PLACEHOLDER_COVER; }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
                    <div style={{ fontSize: 13, color: "var(--text-muted, #80848e)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{artist}</div>
                    {/* Progress bar */}
                    <div style={{ marginTop: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted, #80848e)", marginBottom: 3 }}>
                            <span>{formatTime(progress)}</span>
                            <span>{formatTime(p?.durationMs ?? 0)}</span>
                        </div>
                        <div style={{ height: 4, borderRadius: 2, background: "var(--background-modifier-accent, #1e1f22)", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${progressPct}%`, background: "var(--brand-500, #5865f2)", borderRadius: 2, transition: "width .2s linear" }} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Current lyric */}
            <div style={{
                background: "var(--background-modifier-accent, #1e1f22)",
                borderRadius: 8, padding: "10px 12px", marginBottom: 12
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted, #80848e)", textTransform: "uppercase" }}>Aktualny wers:</span>
                    <span style={{
                        fontSize: 10, padding: "1px 6px", borderRadius: 6,
                        background: "var(--brand-500, #5865f2)", color: "#fff", fontWeight: 600
                    }}>źródło: {source}</span>
                </div>
                <div style={{ fontStyle: active ? "normal" : "italic", color: active ? "var(--text-normal, #dbdee1)" : "var(--text-muted, #80848e)", fontSize: 14 }}>
                    {lyrics}
                </div>
            </div>

            {/* ───── Discord Activity Preview ───── */}
            <div style={sectionTitle}>💬 Podgląd Aktywności Discord</div>
            <div style={{
                background: "var(--background-tertiary, #1e1f22)",
                borderRadius: 8, padding: "10px 12px",
            }}>
                {/* Header row */}
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--text-muted, #80848e)" }}>SŁUCHA</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-normal, #dbdee1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "75%" }}>{discordName}</span>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    {/* Large image only — brak mini ikony */}
                    <div style={{ flexShrink: 0 }}>
                        <img
                            src={(() => {
                                const custom = (settings.store.customLargeImage || "").trim();
                                if (custom) return custom;
                                if (settings.store.showAlbumArt && active && p!.imageUrl) return p!.imageUrl;
                                return "https://via.placeholder.com/60x60/1e1f22/72767d?text=♪";
                            })()}
                            alt="Large"
                            style={{ width: 60, height: 60, borderRadius: 8, objectFit: "cover", display: "block", background: "#1e1f22" }}
                            onError={e => { (e.target as HTMLImageElement).src = "https://via.placeholder.com/60x60/1e1f22/72767d?text=♪"; }}
                        />
                    </div>

                    {/* Text */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-normal, #dbdee1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{discordLine1}</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted, #80848e)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{discordLine2}</div>
                        {settings.store.showTimestamp && active && p!.durationMs > 0 && (
                            <div style={{ fontSize: 11, color: "var(--text-muted, #80848e)", marginTop: 2 }}>
                                {formatTime(progress)} z {formatTime(p!.durationMs)}
                            </div>
                        )}
                    </div>
                </div>


                {/* Spotify button */}
                {settings.store.showSpotifyButton && spotifyTrackId && (
                    <div style={{ marginTop: 8 }}>
                        <a
                            href={`https://open.spotify.com/track/${spotifyTrackId}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                                display: "block", textAlign: "center", padding: "5px 0",
                                borderRadius: 4, fontSize: 13, fontWeight: 600,
                                background: "var(--background-modifier-accent, #1e1f22)",
                                color: "var(--text-normal, #dbdee1)",
                                textDecoration: "none",
                                border: "1px solid var(--background-modifier-selected, #35373c)"
                            }}
                        >
                            Posłuchaj w Spotify
                        </a>
                    </div>
                )}
            </div>

            <div style={{ fontSize: 11, color: "var(--text-muted, #80848e)", marginTop: 8, textAlign: "center" }}>
                Dane z <code style={{ fontSize: 11 }}>localhost:8999/rpc</code> · Odświeżanie co 500ms
            </div>
        </div>
    );
}
