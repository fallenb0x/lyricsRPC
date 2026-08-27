/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2025 LyricsStatus contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { definePluginSettings, SettingsStore } from "@api/Settings";
import { getUserSettingLazy } from "@api/UserSettings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { Activity } from "@vencord/discord-types";
import { ActivityFlags, ActivityType } from "@vencord/discord-types/enums";
import { ApplicationAssetUtils, FluxDispatcher, React } from "@webpack/common";

import { LyricsCard } from "./LyricsCard";

const RPC_URL = "http://127.0.0.1:8999/rpc";
const DEFAULT_APP_ID = "1504970968513122434";

export type LyricsPayload = {
    active: boolean;
    hasLyrics: boolean;
    songName: string;
    songAuthor: string;
    lyrics: string;
    progressMs: number;
    durationMs: number;
    uri?: string;
    imageUrl?: string;
    updatedAt: number;
    source?: string;
};

export let currentPayload: LyricsPayload | null = null;

const ShowCurrentGame = getUserSettingLazy<boolean>("status", "showCurrentGame")!;

export const settings = definePluginSettings({
    formatName: {
        type: OptionType.STRING,
        description: "Format tytułu aktywności (\"Słucha...\")",
        default: "{song_name} - {lyrics}",
        placeholder: "{song_name} - {lyrics}",
        restartNeeded: false,
    },
    formatDetails: {
        type: OptionType.STRING,
        description: "Format 1. linii (Details)",
        default: "{song_name} - {song_author}",
        placeholder: "{song_name} - {song_author}",
        restartNeeded: false,
    },
    formatState: {
        type: OptionType.STRING,
        description: "Format 2. linii (State)",
        default: "{lyrics}",
        placeholder: "{lyrics}",
        restartNeeded: false,
    },
    showTimestamp: {
        type: OptionType.BOOLEAN,
        description: "Pokazuj licznik czasu odtwarzania w Discordzie",
        default: true,
        restartNeeded: false,
    },
    showSpotifyButton: {
        type: OptionType.BOOLEAN,
        description: "Pokazuj przycisk \"Posłuchaj w Spotify\"",
        default: true,
        restartNeeded: false,
    },
    showAlbumArt: {
        type: OptionType.BOOLEAN,
        description: "Pokazuj okładkę albumu jako duży obraz (gdy nie podano własnego)",
        default: true,
        restartNeeded: false,
    },
    customLargeImage: {
        type: OptionType.STRING,
        description: "Własny URL dużego obrazu (np. gif z imgur). Jeśli puste, używa okładki albumu.",
        default: "",
        placeholder: "https://i.imgur.com/1JVCrWy.gif",
        restartNeeded: false,
    }
});

const assetCache = new Map<string, string>();

async function getApplicationAsset(appId: string, key: string): Promise<string | undefined> {
    if (!key) return undefined;
    const cacheKey = `${appId}:${key}`;
    if (assetCache.has(cacheKey)) return assetCache.get(cacheKey);

    try {
        const assets = await ApplicationAssetUtils.fetchAssetIds(appId, [key]);
        const res = assets?.[0] || key;
        assetCache.set(cacheKey, res);
        return res;
    } catch {
        return key;
    }
}

function crop(text: string, maxLen = 128): string {
    return (text || "").replace(/\s+/g, " ").trim().slice(0, maxLen);
}

const NO_LYRICS_TEXT = "coś się, coś się popsuło i nie ma tekstu :3";

function applyFormat(format: string, p: LyricsPayload): string {
    const effectiveLyrics = p.lyrics || (p.active ? NO_LYRICS_TEXT : "");
    let res = format
        .replace(/\{song_name\}/g, p.songName || "")
        .replace(/\{song_author\}/g, p.songAuthor || "")
        .replace(/\{lyrics\}/g, effectiveLyrics);

    res = res.replace(/[\s\-_–—]+$/, "").trim();
    return crop(res);
}

async function buildActivity(p: LyricsPayload, overrides?: {
    appId?: string;
    formatName?: string;
    formatDetails?: string;
    formatState?: string;
    showTimestamp?: boolean;
    showSpotifyButton?: boolean;
}): Promise<Activity | null> {
    if (!p.active) return null;

    const appId = overrides?.appId || DEFAULT_APP_ID;
    const formatName = overrides?.formatName ?? settings.store.formatName;
    const formatDetails = overrides?.formatDetails ?? settings.store.formatDetails;
    const formatState = overrides?.formatState ?? settings.store.formatState;
    const showTimestamp = overrides?.showTimestamp ?? settings.store.showTimestamp;
    const showSpotifyButton = overrides?.showSpotifyButton ?? settings.store.showSpotifyButton;

    const name = crop(applyFormat(formatName, p) || p.songName);
    const details = crop(applyFormat(formatDetails, p));
    const state = crop(applyFormat(formatState, p));

    const activity: Activity = {
        application_id: appId,
        name,
        details: details || undefined,
        state: state || undefined,
        type: ActivityType.LISTENING,
        flags: ActivityFlags.INSTANCE,
    };

    // Timestamps
    if (showTimestamp && p.durationMs > 0) {
        const now = Date.now();
        activity.timestamps = {
            start: Math.floor(now - p.progressMs),
            end: Math.floor(now + (p.durationMs - p.progressMs)),
        };
    }

    // Large image: własny URL > okładka albumu
    const customImg = (settings.store.customLargeImage || "").trim();
    const largeImageUrl = customImg || (settings.store.showAlbumArt ? (p.imageUrl || "") : "");

    if (largeImageUrl) {
        const assetId = await getApplicationAsset(appId, largeImageUrl);
        if (assetId) {
            activity.assets = {
                large_image: assetId,
            };
        }
    }

    // Spotify button
    if (showSpotifyButton && p.uri) {
        const m = /^spotify:track:([A-Za-z0-9]+)$/.exec(p.uri);
        if (m) {
            activity.buttons = ["Posłuchaj w Spotify"];
            activity.metadata = { button_urls: [`https://open.spotify.com/track/${m[1]}`] };
        }
    }

    // Strip empty keys
    for (const k in activity) {
        if (k === "type" || k === "flags") continue;
        const v = (activity as any)[k];
        if (v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0))
            delete (activity as any)[k];
    }

    return activity;
}

let lastDispatchedTime = 0;
let pendingTimeout: ReturnType<typeof setTimeout> | undefined;

function setActivity(activity: Activity | null) {
    const now = Date.now();
    const elapsed = now - lastDispatchedTime;

    // Discord Gateway presence rate limit protection (zbalansowany 250ms throttle — brak pomijania linijek)
    if (elapsed < 250 && activity !== null) {
        if (pendingTimeout) clearTimeout(pendingTimeout);
        pendingTimeout = setTimeout(() => {
            lastDispatchedTime = Date.now();
            FluxDispatcher.dispatch({
                type: "LOCAL_ACTIVITY_UPDATE",
                activity,
                socketId: "LyricsRPC",
            });
        }, 250 - elapsed);
        return;
    }

    if (pendingTimeout) {
        clearTimeout(pendingTimeout);
        pendingTimeout = undefined;
    }

    lastDispatchedTime = now;
    FluxDispatcher.dispatch({
        type: "LOCAL_ACTIVITY_UPDATE",
        activity,
        socketId: "LyricsRPC",
    });
}

let serverConfigVersion = 0;
let lastSyncedVersion = 0;

/** Push local Vencord settings → server so WebUI stays in sync */
async function pushSettingsToServer() {
    try {
        const res = await fetch("http://127.0.0.1:8999/api/config", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                discord: {
                    showTimestamps: settings.store.showTimestamp,
                    showButtons: settings.store.showSpotifyButton,
                    showAlbumArt: settings.store.showAlbumArt,
                    customLargeImage: settings.store.customLargeImage || "",
                    format: {
                        name: settings.store.formatName,
                        details: settings.store.formatDetails,
                        state: settings.store.formatState,
                    }
                }
            })
        });
        if (res.ok) {
            const data = await res.json();
            if (data.version) {
                lastSyncedVersion = data.version;
            }
        }
    } catch { /* server offline */ }
}

let pollInterval: ReturnType<typeof setInterval> | undefined;
let lastSig = "";

async function poll() {
    let payload: LyricsPayload | null = null;
    try {
        const res = await fetch(RPC_URL, { cache: "no-store" });
        if (res.ok) {
            const data = await res.json();
            payload = data;
            
            // Only update local settings if the server has a newer version (e.g. changed via WebUI)
            const srvVer = data.config?.version || 0;
            if (srvVer > lastSyncedVersion && data.config?.discord) {
                lastSyncedVersion = srvVer;
                const srv = data.config.discord;
                if (srv.format?.name !== undefined) settings.store.formatName = srv.format.name;
                if (srv.format?.details !== undefined) settings.store.formatDetails = srv.format.details;
                if (srv.format?.state !== undefined) settings.store.formatState = srv.format.state;
                if (srv.showTimestamps !== undefined) settings.store.showTimestamp = srv.showTimestamps;
                if (srv.showButtons !== undefined) settings.store.showSpotifyButton = srv.showButtons;
                if (srv.showAlbumArt !== undefined) settings.store.showAlbumArt = srv.showAlbumArt;
                if (srv.customLargeImage !== undefined) settings.store.customLargeImage = srv.customLargeImage;
            }
        }
    } catch { /* server offline */ }

    // Ustawienia czytamy BEZPOŚREDNIO z settings.store (Vencord jest źródłem prawdy dla Activity)
    const effectiveAppId = settings.store.appId || DEFAULT_APP_ID;
    const effectiveFormatName = settings.store.formatName;
    const effectiveFormatDetails = settings.store.formatDetails;
    const effectiveFormatState = settings.store.formatState;
    const effectiveShowTimestamps = settings.store.showTimestamp;
    const effectiveShowButtons = settings.store.showSpotifyButton;
    const effectiveShowAlbumArt = settings.store.showAlbumArt;
    const effectiveCustomLargeImage = settings.store.customLargeImage;

    const sig = JSON.stringify([
        payload?.active,
        payload?.songName,
        payload?.songAuthor,
        payload?.lyrics,
        payload?.durationMs,
        payload?.imageUrl,
        effectiveAppId,
        effectiveFormatName,
        effectiveFormatDetails,
        effectiveFormatState,
        effectiveShowTimestamps,
        effectiveShowButtons,
        effectiveShowAlbumArt,
        effectiveCustomLargeImage,
    ]);
    if (sig === lastSig) return;
    lastSig = sig;

    currentPayload = payload;

    const act = payload?.active ? await buildActivity(payload, {
        appId: effectiveAppId,
        formatName: effectiveFormatName,
        formatDetails: effectiveFormatDetails,
        formatState: effectiveFormatState,
        showTimestamp: effectiveShowTimestamps,
        showSpotifyButton: effectiveShowButtons,
    }) : null;
    setActivity(act);
}

export default definePlugin({
    name: "LyricsRPC",
    description: "Wyświetla aktualnie odtwarzany utwór wraz z tekstem na profilu Discord (Lyrics RPC)",
    tags: ["Activity", "Spotify", "Lyrics", "Music", "RPC"],
    authors: [Devs.fallenb0x],
    dependencies: ["UserSettingsAPI"],
    requiresRestart: false,
    settings,

    patches: [
        {
            // pozwól widzieć własne przyciski aktywności
            find: ".USER_PROFILE_ACTIVITY_BUTTONS),",
            replacement: {
                match: /.getId\(\)===\i.id/,
                replace: "$& && false"
            }
        }
    ],

    start() {
        if (pollInterval) clearInterval(pollInterval);
        lastSig = "";
        void poll();
        pollInterval = setInterval(() => void poll(), 80);

        // Watch for Vencord settings changes and push them to server immediately
        SettingsStore.addPrefixChangeListener("plugins.LyricsRPC", () => {
            void pushSettingsToServer();
        });
    },

    stop() {
        if (pollInterval) clearInterval(pollInterval);
        pollInterval = undefined;
        currentPayload = null;
        lastSig = "";
        setActivity(null);
    },

    settingsAboutComponent() {
        const gameActivityEnabled = ShowCurrentGame.useSetting();
        return (
            <div>
                {!gameActivityEnabled && (
                    <div style={{
                        background: "var(--status-danger-background)",
                        border: "1px solid var(--status-danger)",
                        borderRadius: 8,
                        padding: "12px 16px",
                        marginBottom: 12,
                        color: "var(--status-danger-text)",
                        fontWeight: 600,
                    }}>
                        ⚠️ Udostępnianie aktywności jest wyłączone! Włącz je w ustawieniach Discorda → Prywatność → Aktywność.
                    </div>
                )}
                <LyricsCard />
            </div>
        );
    }
});
