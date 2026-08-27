import { readFileSync, writeFileSync } from "node:fs"
import { Debug } from "./Debug"

export class Settings {
    public static credentials = {
        token: "",
        cookies: "",
        clientID: "",
        clientSecret: "",
        useExternalAuthServer: "",
        code: "",
        refreshToken: "",
        uuid: "",
        customRedirectUri: ""
    }

    public static view = {
        timestamp: true,
        label: true,
        advanced: {
            enabled: false,
            customEmoji: "🎶",
            customStatus: "[{timestamp}] [{lyrics}]"
        }
    }

    public static timings= {
        sendTimeOffset: 500,
        enableAutooffset: true,
        autooffset: 3
    }

    public static update = {
        enableAutoupdate: true
    }

    public static discord = {
        clientId: "1504970968513122434",
        enabled: true,
        showTimestamps: true,
        showButtons: true,
        showAlbumArt: true,
        customLargeImage: "",
        format: {
            name: "{song_name} - {lyrics}",
            details: "{song_name} - {song_author}",
            state: "{lyrics}"
        }
    }

    public static save(): void {
        writeFileSync("./settings.json", JSON.stringify({
            credentials: this.credentials,
            view: this.view,
            timings: this.timings,
            update: this.update,
            discord: this.discord
        }, null, 2))
    }

    public static load(): void {
        let settings

        try {
            settings = JSON.parse(readFileSync("./settings.json").toString())
        } catch(e) {
            Debug.write("An error occurred while trying to read settings from file. Using defaults. Error: " + (e as Error).stack)
        }

        if (settings) {
            this.credentials = settings.credentials || this.credentials
            this.view = settings.view || this.view
            this.timings = settings.timings || this.timings
            this.update = settings.update || this.update
            this.discord = settings.discord || this.discord
        }
    }
}
