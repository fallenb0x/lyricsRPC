import { BaseSource, SongLyrics } from "./BaseSource";

interface LyricsResponse {
    id: number;
    name: string;
    trackName: string;
    artistName: string;
    albumName: string;
    plainLyrics: string | null;
    syncedLyrics: string | null;
}

export class LrcLibSource extends BaseSource {
    private readonly baseUrl = "https://lrclib.net/api";

    public getAppName(): string {
        return "LrcLib";
    }

    public async getLyrics(name: string, artist: string): Promise<SongLyrics> {
        const cleanName = name.replace(/\s*\(.*?\)\s*/g, " ").trim();
        const response = await fetch(
            `${this.baseUrl}/get?track_name=${encodeURIComponent(cleanName)}&artist_name=${encodeURIComponent(artist)}`
        );

        if (!response.ok) throw new Error(`Request failed: ${response.status}`);

        const json = (await response.json()) as LyricsResponse;

        if (!json.syncedLyrics || !json.syncedLyrics.trim()) {
            throw new Error("No synced lyrics found");
        }

        return this.parseLyrics(json.syncedLyrics);
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
