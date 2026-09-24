export interface LyricsLine {
    time: number;
    text: string;
}

export interface SongLyrics {
    lines: LyricsLine[];
}

export abstract class BaseSource {
    public abstract getAppName(): string;
    public abstract getLyrics(name: string, artist: string): Promise<SongLyrics>;
}
