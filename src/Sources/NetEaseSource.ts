import { BaseSource, SongLyrics } from "./BaseSource";

interface SearchResponse {
    result?: {
        songs?: {
            id: number;
        }[];
        songCount?: number;
    };
}

interface LyricsResponse {
    lrc?: {
        lyric?: string;
    };
}

export class NetEaseSource extends BaseSource {
    public getAppName(): string {
        return "NetEase Music";
    }

    public async getLyrics(name: string, artist: string): Promise<SongLyrics> {
        const cleanName = name.replace(/\s*\(.*?\)\s*/g, " ").trim();
        const searchRes = await fetch(
            `https://music.163.com/api/search/get?s=${encodeURIComponent(`${cleanName} ${artist}`)}&type=1&offset=0&limit=3`,
            {
                headers: {
                    "Referer": "https://music.163.com",
                    "Cookie": "appver=2.0.2",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
                }
            }
        );

        if (!searchRes.ok) throw new Error("Search failed");
        const searchJson = (await searchRes.json()) as SearchResponse;
        const songs = searchJson.result?.songs;
        if (!songs || songs.length === 0) throw new Error("Song not found on NetEase");

        const songId = songs[0].id;
        const lyricsRes = await fetch(`https://music.163.com/api/song/lyric?tv=-1&kv=-1&lv=-1&os=pc&id=${songId}`, {
            headers: {
                "Referer": "https://music.163.com",
                "Cookie": "appver=2.0.2"
            }
        });

        if (!lyricsRes.ok) throw new Error("Lyrics fetch failed");
        const lyricsJson = (await lyricsRes.json()) as LyricsResponse;
        if (!lyricsJson.lrc?.lyric) throw new Error("No lyrics field on NetEase");

        return this.parseLyrics(lyricsJson.lrc.lyric);
    }

    private parseLyrics(lyrics: string): SongLyrics {
        const result: SongLyrics = { lines: [] };
        const lines = lyrics.split("\n");
        const regexp = /\[(\d\d):(\d\d)(?:\.(\d\d?\d?))?]/g;

        for (const line of lines) {
            if (!line.trim()) continue;

            let match: RegExpExecArray | null;
            regexp.lastIndex = 0;
            const timestamps: number[] = [];

            while ((match = regexp.exec(line)) !== null) {
                const min = parseInt(match[1]);
                const sec = parseInt(match[2]);
                const rawMs = match[3] || "0";
                const ms = parseInt(rawMs.padEnd(3, "0").slice(0, 3));
                timestamps.push((min * 60 + sec) * 1000 + ms);
            }

            const text = line.replace(regexp, "").trim();
            if (timestamps.length > 0 && text) {
                for (const t of timestamps) {
                    result.lines.push({ time: t, text });
                }
            }
        }

        result.lines.sort((a, b) => a.time - b.time);
        return result;
    }
}
