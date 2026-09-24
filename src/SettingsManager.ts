import fs from "fs";
import path from "path";

export interface DiscordSettings {
    clientId: string;
    enabled: boolean;
    showTimestamps: boolean;
    showAlbumArt: boolean;
    customLargeImage: string;
    format: {
        name: string;
        details: string;
        state: string;
    };
}

export interface AppSettings {
    port: number;
    openBrowserOnStart: boolean;
    minimizeToTray: boolean;
    discord: DiscordSettings;
}

const DEFAULT_SETTINGS: AppSettings = {
    port: 8999,
    openBrowserOnStart: true,
    minimizeToTray: true,
    discord: {
        clientId: "1504970968513122434",
        enabled: true,
        showTimestamps: true,
        showAlbumArt: true,
        customLargeImage: "",
        format: {
            name: "{song_name} - {lyrics}",
            details: "{song_name} - {song_author}",
            state: "{lyrics}"
        }
    }
};

export class SettingsManager {
    private filePath: string;
    public settings: AppSettings;
    public version: number = 1;

    constructor(filePath?: string) {
        if (filePath) {
            this.filePath = filePath;
        } else {
            const cwdPath = path.join(process.cwd(), "settings.json");
            const exeDir = path.dirname(process.execPath);
            const exePath = path.join(exeDir, "settings.json");
            const parentPath = path.join(exeDir, "..", "settings.json");

            if (fs.existsSync(cwdPath)) {
                this.filePath = cwdPath;
            } else if (fs.existsSync(exePath)) {
                this.filePath = exePath;
            } else if (fs.existsSync(parentPath)) {
                this.filePath = parentPath;
            } else {
                this.filePath = cwdPath;
            }
        }
        this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        this.load();
    }

    public load(): void {
        try {
            if (fs.existsSync(this.filePath)) {
                const data = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
                this.settings = {
                    ...DEFAULT_SETTINGS,
                    ...data,
                    discord: {
                        ...DEFAULT_SETTINGS.discord,
                        ...(data.discord || {}),
                        format: {
                            ...DEFAULT_SETTINGS.discord.format,
                            ...(data.discord?.format || {})
                        }
                    }
                };
                if (!this.settings.discord.clientId || this.settings.discord.clientId === "YOUR_DISCORD_CLIENT_ID") {
                    this.settings.discord.clientId = DEFAULT_SETTINGS.discord.clientId;
                }
            } else {
                this.save();
            }
        } catch (e) {
            console.error("Failed to load settings:", e);
        }
    }

    public save(): void {
        try {
            this.version++;
            const dir = path.dirname(this.filePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(this.filePath, JSON.stringify(this.settings, null, 2), "utf8");
        } catch (e) {
            console.error("Failed to save settings:", e);
        }
    }

    public updateDiscord(discordUpdates: Partial<DiscordSettings>): void {
        this.settings.discord = {
            ...this.settings.discord,
            ...discordUpdates,
            format: {
                ...this.settings.discord.format,
                ...(discordUpdates.format || {})
            }
        };
        this.save();
    }
}
