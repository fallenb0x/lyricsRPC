import { BaseSource, SongLyrics } from "./Sources/BaseSource";
import { LrcLibSource } from "./Sources/LrcLibSource";
import { NetEaseSource } from "./Sources/NetEaseSource";
import fs from "fs";
import path from "path";

export interface CachedSongLyrics {
    name: string;
    artist: string;
    source: string;
    lyrics: SongLyrics;
    savedAt: number;
}

export class LyricsManager {
    private sources: BaseSource[] = [];
    private cacheDir: string;
    public lastFetchedFrom: string = "Brak";
    private artworkCache: Map<string, string> = new Map();

    constructor(cacheDir?: string) {
        this.cacheDir = cacheDir || path.join(process.cwd(), "cache");
        if (!fs.existsSync(this.cacheDir)) {
            try { fs.mkdirSync(this.cacheDir, { recursive: true }); } catch {}
        }

        // Add source cascade
        this.sources.push(new LrcLibSource());
        this.sources.push(new NetEaseSource());
    }

    private getCacheKey(name: string, artist: string): string {
        const clean = `${name}_${artist}`.toLowerCase().replace(/[^a-z0-9]/gi, "_");
        return path.join(this.cacheDir, `${clean}.json`);
    }

    public async getLyrics(name: string, artist: string): Promise<SongLyrics | null> {
        if (!name || !artist) return null;

        const cacheFile = this.getCacheKey(name, artist);
        if (fs.existsSync(cacheFile)) {
            try {
                const data = JSON.parse(fs.readFileSync(cacheFile, "utf8")) as CachedSongLyrics;
                if (data.lyrics && Array.isArray(data.lyrics.lines)) {
                    this.lastFetchedFrom = `Pamięć podręczna (${data.source})`;
                    return data.lyrics;
                }
            } catch {}
        }

        for (const source of this.sources) {
            try {
                const lyrics = await source.getLyrics(name, artist);
                if (lyrics && lyrics.lines && lyrics.lines.length > 0) {
                    this.lastFetchedFrom = source.getAppName();
                    try {
                        const cacheObj: CachedSongLyrics = {
                            name,
                            artist,
                            source: this.lastFetchedFrom,
                            lyrics,
                            savedAt: Date.now()
                        };
                        fs.writeFileSync(cacheFile, JSON.stringify(cacheObj, null, 2), "utf8");
                    } catch {}
                    return lyrics;
                }
            } catch {}
        }

        this.lastFetchedFrom = "Brak";
        return null;
    }

    public async getArtwork(name: string, artist: string, albumTitle?: string): Promise<string> {
        if (!name || !artist) return "";

        const cacheKey = `${name}|${artist}|${albumTitle || ""}`.toLowerCase();
        if (this.artworkCache.has(cacheKey)) {
            return this.artworkCache.get(cacheKey)!;
        }

        const cleanName = name.replace(/\s*\(.*?\)\s*/g, " ").trim();
        const cleanArtist = artist.split(",")[0].trim();

        // 1. Try Deezer Search (Very fast, accurate for international & Polish albums, high resolution 1000x1000)
        const deezerQueries: string[] = [];
        if (albumTitle) {
            deezerQueries.push(`${cleanArtist} ${cleanName} ${albumTitle}`.trim());
            deezerQueries.push(`${cleanArtist} ${albumTitle}`.trim());
        }
        deezerQueries.push(`${cleanArtist} ${cleanName}`.trim());

        for (const q of deezerQueries) {
            try {
                const res = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=5`);
                if (res.ok) {
                    const data = (await res.json()) as any;
                    if (data.data && data.data.length > 0) {
                        let best = data.data[0];
                        if (albumTitle) {
                            const found = data.data.find((x: any) =>
                                x.album?.title?.toLowerCase().includes(albumTitle.toLowerCase()) ||
                                albumTitle.toLowerCase().includes(x.album?.title?.toLowerCase())
                            );
                            if (found) best = found;
                        }
                        const cover = best.album?.cover_xl || best.album?.cover_big;
                        if (cover) {
                            this.artworkCache.set(cacheKey, cover);
                            return cover;
                        }
                    }
                }
            } catch {}
        }

        // 2. Try Spotify Scraper via DuckDuckGo & Spotify oEmbed
        const spotifyQueries: string[] = [];
        if (albumTitle) {
            spotifyQueries.push(`site:open.spotify.com/album "${cleanArtist}" "${albumTitle}"`);
            spotifyQueries.push(`site:open.spotify.com/track "${cleanArtist}" "${cleanName}" "${albumTitle}"`);
        }
        spotifyQueries.push(`site:open.spotify.com/track "${cleanArtist}" "${cleanName}"`);

        for (const q of spotifyQueries) {
            try {
                const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
                const res = await fetch(ddgUrl, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                    }
                });
                if (res.ok) {
                    const html = await res.text();
                    const trackMatch = html.match(/open\.spotify\.com\/track\/([a-zA-Z0-9]+)/);
                    if (trackMatch) {
                        const oembed = await fetch(`https://open.spotify.com/oembed?url=https://open.spotify.com/track/${trackMatch[1]}`);
                        if (oembed.ok) {
                            const data = (await oembed.json()) as any;
                            if (data.thumbnail_url) {
                                const cover = data.thumbnail_url
                                    .replace(/ab67616d00001e02/g, "ab67616d0000b273")
                                    .replace(/ab67616d00004851/g, "ab67616d0000b273");
                                this.artworkCache.set(cacheKey, cover);
                                return cover;
                            }
                        }
                    }
                    const albumMatch = html.match(/open\.spotify\.com\/album\/([a-zA-Z0-9]+)/);
                    if (albumMatch) {
                        const oembed = await fetch(`https://open.spotify.com/oembed?url=https://open.spotify.com/album/${albumMatch[1]}`);
                        if (oembed.ok) {
                            const data = (await oembed.json()) as any;
                            if (data.thumbnail_url) {
                                const cover = data.thumbnail_url
                                    .replace(/ab67616d00001e02/g, "ab67616d0000b273")
                                    .replace(/ab67616d00004851/g, "ab67616d0000b273");
                                this.artworkCache.set(cacheKey, cover);
                                return cover;
                            }
                        }
                    }
                }
            } catch {}
        }

        // 3. Try iTunes Fallback
        const itunesQueries: string[] = [];
        if (albumTitle) {
            itunesQueries.push(`${cleanName} ${cleanArtist} ${albumTitle}`.trim());
        }
        itunesQueries.push(`${cleanName} ${cleanArtist}`.trim());

        for (const q of itunesQueries) {
            try {
                const encoded = encodeURIComponent(q);
                const res = await fetch(`https://itunes.apple.com/search?term=${encoded}&media=music&entity=song&limit=5`);
                if (res.ok) {
                    const data = (await res.json()) as any;
                    if (data.results && data.results.length > 0) {
                        let bestMatch = data.results[0];
                        if (albumTitle) {
                            const found = data.results.find((r: any) =>
                                r.collectionName?.toLowerCase().includes(albumTitle.toLowerCase()) ||
                                albumTitle.toLowerCase().includes(r.collectionName?.toLowerCase())
                            );
                            if (found) bestMatch = found;
                        }

                        const art = bestMatch.artworkUrl100;
                        if (art) {
                            const cover = art.replace(/100x100bb\.jpg/g, "600x600bb.jpg");
                            this.artworkCache.set(cacheKey, cover);
                            return cover;
                        }
                    }
                }
            } catch {}
        }

        return "";
    }
}
