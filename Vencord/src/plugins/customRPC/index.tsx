/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { definePluginSettings } from "@api/Settings";
import { getUserSettingLazy } from "@api/UserSettings";
import { Divider } from "@components/Divider";
import { ErrorCard } from "@components/ErrorCard";
import { Flex } from "@components/Flex";
import { Link } from "@components/Link";
import { Devs } from "@utils/constants";
import { isTruthy } from "@utils/guards";
import { Margins } from "@utils/margins";
import { classes } from "@utils/misc";
import { useAwaiter } from "@utils/react";
import definePlugin, { OptionType } from "@utils/types";
import { Activity } from "@vencord/discord-types";
import { ActivityType } from "@vencord/discord-types/enums";
import { findByCodeLazy, findComponentByCodeLazy } from "@webpack";
import { ApplicationAssetUtils, Button, FluxDispatcher, Forms, React, UserStore } from "@webpack/common";

import { RPCSettings } from "./RpcSettings";

const useProfileThemeStyle = findByCodeLazy("profileThemeStyle:", "--profile-gradient-primary-color");
const ActivityView = findComponentByCodeLazy(".party?(0", "USER_PROFILE_ACTIVITY");

const ShowCurrentGame = getUserSettingLazy<boolean>("status", "showCurrentGame")!;

const LYRICS_RPC_URL = "http://127.0.0.1:8999/rpc";
const LYRICS_RPC_DEFAULT_APP_ID = "1504970968513122434";
const LYRICS_RPC_DEFAULT_APP_NAME = "Lyrics Status";

type LyricsRpcPayload = {
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
};

let lyricsRpcPayload: LyricsRpcPayload | null = null;
let lyricsRpcInterval: ReturnType<typeof setInterval> | undefined;
let lyricsRpcSignature = "";

function cropActivityText(value?: string) {
    return (value || "").replace(/\s+/g, " ").trim().slice(0, 128);
}

function getLyricsRpcSignature(payload: LyricsRpcPayload | null) {
    if (!payload) return "offline";

    return JSON.stringify([
        payload.active,
        payload.songName,
        payload.songAuthor,
        payload.lyrics,
        payload.hasLyrics,
        payload.durationMs
    ]);
}

async function pollLyricsRpc() {
    let nextPayload: LyricsRpcPayload | null = null;

    try {
        const res = await fetch(LYRICS_RPC_URL, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        nextPayload = await res.json() as LyricsRpcPayload;
    } catch {}

    const nextSignature = getLyricsRpcSignature(nextPayload);
    if (nextSignature === lyricsRpcSignature) return;

    lyricsRpcPayload = nextPayload;
    lyricsRpcSignature = nextSignature;
    await setRpc();
}

function startLyricsRpcBridge() {
    if (lyricsRpcInterval) clearInterval(lyricsRpcInterval);
    lyricsRpcSignature = "";
    void pollLyricsRpc();
    lyricsRpcInterval = setInterval(() => void pollLyricsRpc(), 100);
}

function stopLyricsRpcBridge() {
    if (lyricsRpcInterval) clearInterval(lyricsRpcInterval);
    lyricsRpcInterval = undefined;
    lyricsRpcPayload = null;
    lyricsRpcSignature = "";
    void setRpc(true);
}

async function getApplicationAsset(key: string): Promise<string> {
    return (await ApplicationAssetUtils.fetchAssetIds(settings.store.appID || LYRICS_RPC_DEFAULT_APP_ID, [key]))[0];
}

export const enum TimestampMode {
    NONE,
    NOW,
    TIME,
    CUSTOM,
}

export const settings = definePluginSettings({
    config: {
        type: OptionType.COMPONENT,
        component: RPCSettings
    },
}).withPrivateSettings<{
    appID?: string;
    appName?: string;
    details?: string;
    detailsURL?: string;
    state?: string;
    stateURL?: string;
    type?: ActivityType;
    streamLink?: string;
    timestampMode?: TimestampMode;
    startTime?: number;
    endTime?: number;
    imageBig?: string;
    imageBigURL?: string;
    imageBigTooltip?: string;
    imageSmall?: string;
    imageSmallURL?: string;
    imageSmallTooltip?: string;
    buttonOneText?: string;
    buttonOneURL?: string;
    buttonTwoText?: string;
    buttonTwoURL?: string;
    partySize?: number;
    partyMaxSize?: number;
}>();

async function createActivity(): Promise<Activity | undefined> {
    const {
        appID,
        appName,
        details,
        detailsURL,
        state,
        stateURL,
        type,
        streamLink,
        startTime,
        endTime,
        imageBig,
        imageBigURL,
        imageBigTooltip,
        imageSmall,
        imageSmallURL,
        imageSmallTooltip,
        buttonOneText,
        buttonOneURL,
        buttonTwoText,
        buttonTwoURL,
        partyMaxSize,
        partySize,
        timestampMode
    } = settings.store;

    const activityAppID = appID || LYRICS_RPC_DEFAULT_APP_ID;
    const activityAppName = appName || LYRICS_RPC_DEFAULT_APP_NAME;

    if (!activityAppName) return;
    if (lyricsRpcPayload && !lyricsRpcPayload.active) return;

    const lyrics = lyricsRpcPayload?.active ? lyricsRpcPayload : null;
    const currentLyric = lyrics ? cropActivityText(lyrics.lyrics || "Lyrics unavailable") : undefined;
    const songTitle = lyrics ? cropActivityText(lyrics.songName) : undefined;
    const dynamicName = lyrics
        ? cropActivityText(`${songTitle}${currentLyric ? ` - ${currentLyric}` : ""}`) || activityAppName
        : activityAppName;
    const dynamicDetails = lyrics
        ? cropActivityText(`${lyrics.songName}${lyrics.songAuthor ? ` - ${lyrics.songAuthor}` : ""}`)
        : details;
    const dynamicState = lyrics ? currentLyric : state;

    const activity: Activity = {
        application_id: activityAppID,
        name: dynamicName,
        state: dynamicState,
        details: dynamicDetails,
        type: type ?? ActivityType.LISTENING,
        flags: 1 << 0,
    };

    if (type === ActivityType.STREAMING) activity.url = streamLink;

    switch (timestampMode) {
        case TimestampMode.NOW:
            activity.timestamps = {
                start: Date.now()
            };
            break;
        case TimestampMode.TIME:
            activity.timestamps = {
                start: Date.now() - (new Date().getHours() * 3600 + new Date().getMinutes() * 60 + new Date().getSeconds()) * 1000
            };
            break;
        case TimestampMode.CUSTOM:
            if (startTime || endTime) {
                activity.timestamps = {};
                if (startTime) activity.timestamps.start = startTime;
                if (endTime) activity.timestamps.end = endTime;
            }
            break;
        case TimestampMode.NONE:
        default:
            if (lyrics && lyrics.durationMs > 0 && lyrics.progressMs >= 0) {
                activity.timestamps = {
                    start: Math.floor(Date.now() - lyrics.progressMs),
                    end: Math.floor(Date.now() + (lyrics.durationMs - lyrics.progressMs))
                };
            }
            break;
    }


    if (detailsURL) {
        activity.details_url = detailsURL;
    }

    if (stateURL) {
        activity.state_url = stateURL;
    }

    if (buttonOneText) {
        activity.buttons = [
            buttonOneText,
            buttonTwoText
        ].filter(isTruthy);

        activity.metadata = {
            button_urls: [
                buttonOneURL,
                buttonTwoURL
            ].filter(isTruthy)
        };
    } else if (lyrics?.uri) {
        const match = /^spotify:track:([A-Za-z0-9]+)$/.exec(lyrics.uri);
        if (match) {
            activity.buttons = ["Posłuchaj w Spotify"];
            activity.metadata = {
                button_urls: [`https://open.spotify.com/track/${match[1]}`]
            };
        }
    }

    if (imageBig) {
        activity.assets = {
            large_image: await getApplicationAsset(imageBig),
            large_text: imageBigTooltip || undefined,
            large_url: imageBigURL || undefined
        };
    } else if (lyrics?.imageUrl) {
        activity.assets = {
            large_image: lyrics.imageUrl,
            large_text: lyrics.songName || "Spotify",
            small_image: "spotify",
            small_text: "Spotify"
        };
    }

    if (imageSmall) {
        activity.assets = {
            ...activity.assets,
            small_image: await getApplicationAsset(imageSmall),
            small_text: imageSmallTooltip || undefined,
            small_url: imageSmallURL || undefined
        };
    }

    if (partyMaxSize && partySize) {
        activity.party = {
            size: [partySize, partyMaxSize]
        };
    }

    for (const k in activity) {
        if (k === "type") continue;
        const v = activity[k];
        if (!v || v.length === 0)
            delete activity[k];
    }

    return activity;
}

export async function setRpc(disable?: boolean) {
    const activity: Activity | undefined = await createActivity();

    FluxDispatcher.dispatch({
        type: "LOCAL_ACTIVITY_UPDATE",
        activity: !disable ? activity : null,
        socketId: "CustomRPC",
    });
}

export default definePlugin({
    name: "CustomRPC",
    description: "Add a fully customisable Rich Presence (Game status) to your Discord profile",
    tags: ["Activity", "Customisation"],
    authors: [Devs.captain, Devs.AutumnVN, Devs.nin0dev],
    dependencies: ["UserSettingsAPI"],
    // This plugin's patch is not important for functionality, so don't require a restart
    requiresRestart: false,
    settings,

    start: startLyricsRpcBridge,
    stop: stopLyricsRpcBridge,

    // Discord hides buttons on your own Rich Presence for some reason. This patch disables that behaviour
    patches: [
        {
            find: ".USER_PROFILE_ACTIVITY_BUTTONS),",
            replacement: {
                match: /.getId\(\)===\i.id/,
                replace: "$& && false"
            }
        }
    ],

    settingsAboutComponent: () => {
        const [activity] = useAwaiter(createActivity, { fallbackValue: undefined, deps: Object.values(settings.store) });
        const gameActivityEnabled = ShowCurrentGame.useSetting();
        const { profileThemeStyle } = useProfileThemeStyle({});

        return (
            <>
                {!gameActivityEnabled && (
                    <ErrorCard
                        className={classes(Margins.top16, Margins.bottom16)}
                        style={{ padding: "1em" }}
                    >
                        <Forms.FormTitle>Notice</Forms.FormTitle>
                        <Forms.FormText>Activity Sharing isn't enabled, people won't be able to see your custom rich presence!</Forms.FormText>

                        <Button
                            color={Button.Colors.TRANSPARENT}
                            className={Margins.top8}
                            onClick={() => ShowCurrentGame.updateSetting(true)}
                        >
                            Enable
                        </Button>
                    </ErrorCard>
                )}

                <Flex flexDirection="column" gap=".5em" className={Margins.top16}>
                    <Forms.FormText>
                        Go to the <Link href="https://discord.com/developers/applications">Discord Developer Portal</Link> to create an application and
                        get the application ID.
                    </Forms.FormText>
                    <Forms.FormText>
                        Upload images in the Rich Presence tab to get the image keys.
                    </Forms.FormText>
                    <Forms.FormText>
                        If you want to use an image link, download your image and reupload the image to <Link href="https://imgur.com">Imgur</Link> and get the image link by right-clicking the image and selecting "Copy image address".
                    </Forms.FormText>
                    <Forms.FormText>
                        You can't see your own buttons on your profile, but everyone else can see it fine.
                    </Forms.FormText>
                    <Forms.FormText>
                        Some weird unicode text ("fonts" 𝖑𝖎𝖐𝖊 𝖙𝖍𝖎𝖘) may cause the rich presence to not show up, try using normal letters instead.
                    </Forms.FormText>
                </Flex>

                <Divider className={Margins.top8} />

                <div style={{ width: "284px", ...profileThemeStyle, marginTop: 8, borderRadius: 8, background: "var(--background-mod-muted)" }}>
                    {activity && <ActivityView
                        activity={activity}
                        user={UserStore.getCurrentUser()}
                        currentUser={UserStore.getCurrentUser()}
                    />}
                </div>
            </>
        );
    }
});
