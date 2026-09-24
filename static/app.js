(function() {
    let ws = null;
    let currentConfig = {};
    let currentPlayback = {};
    let currentDiscord = {};

    const elBadgeDiscord = document.getElementById("badge-discord");
    const elBadgeSpicetify = document.getElementById("badge-spicetify");
    const elTrackCover = document.getElementById("track-cover");
    const elTrackTitle = document.getElementById("track-title");
    const elTrackArtist = document.getElementById("track-artist");
    const elPlaybackPill = document.getElementById("playback-pill");
    const elTimeCurrent = document.getElementById("time-current");
    const elTimeTotal = document.getElementById("time-total");
    const elProgressBar = document.getElementById("progress-bar-fill");
    const elLyricsCurrent = document.getElementById("lyrics-current");
    const elLyricsSource = document.getElementById("lyrics-source-badge");

    const elDiscordAppName = document.getElementById("discord-app-name");
    const elDiscordLargeImg = document.getElementById("discord-large-img");
    const elDiscordLine1 = document.getElementById("discord-line-1");
    const elDiscordLine2 = document.getElementById("discord-line-2");
    const elDiscordTime = document.getElementById("discord-time");

    const configForm = document.getElementById("config-form");
    const cfgFormatName = document.getElementById("cfg-format-name");
    const cfgFormatDetails = document.getElementById("cfg-format-details");
    const cfgFormatState = document.getElementById("cfg-format-state");
    const cfgShowTimestamps = document.getElementById("cfg-show-timestamps");
    const cfgShowAlbumArt = document.getElementById("cfg-show-album-art");
    const cfgCustomLargeImage = document.getElementById("cfg-custom-large-image");
    const cfgClientId = document.getElementById("cfg-client-id");
    let clientIdDirty = false;
    if (cfgClientId) cfgClientId.addEventListener("input", () => { clientIdDirty = true; });

    function formatTime(ms) {
        if (!ms || isNaN(ms)) return "0:00";
        const totalSec = Math.floor(ms / 1000);
        const mins = Math.floor(totalSec / 60);
        const secs = totalSec % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    const elBadgeDiscordLabel = elBadgeDiscord ? elBadgeDiscord.querySelector(".label") : null;
    const elBadgeSpicetifyLabel = elBadgeSpicetify ? elBadgeSpicetify.querySelector(".label") : null;


    let discordOfflineTimer = null;

    function applyDiscordBadge(className, text) {
        if (elBadgeDiscord && elBadgeDiscord.className !== className) {
            elBadgeDiscord.className = className;
        }
        if (elBadgeDiscordLabel && elBadgeDiscordLabel.textContent !== text) {
            elBadgeDiscordLabel.textContent = text;
        }
    }

    function updateDiscordStatusUI(discord) {
        currentDiscord = discord || {};

        if (currentDiscord.ready) {
            applyDiscordBadge("badge badge-online", `Discord: ${currentDiscord.user?.username || "Połączono"}`);
        } else if (currentDiscord.connected) {
            applyDiscordBadge("badge badge-offline", "Discord: Łączenie...");
        } else {
            applyDiscordBadge("badge badge-offline", "Discord: Rozłączono");
        }
    }

    function updateSpicetifyStatusUI(spicetify) {
        const online = !!(spicetify?.ready || spicetify?.connected || currentPlayback?.active || (currentPlayback?.updatedAt && Date.now() - currentPlayback.updatedAt < 5000));
        const className = online ? "badge badge-online" : "badge badge-offline";
        const text = online ? "Spotify: Aktywne" : "Spotify: Oczekiwanie";

        if (elBadgeSpicetify && elBadgeSpicetify.className !== className) {
            elBadgeSpicetify.className = className;
        }
        if (elBadgeSpicetifyLabel && elBadgeSpicetifyLabel.textContent !== text) {
            elBadgeSpicetifyLabel.textContent = text;
        }
    }

    function applyFormat(format, p) {
        if (!format) return "";
        const effectiveLyrics = p.lyrics || (p.active ? "coś się, coś się popsuło i nie ma tekstu :3" : "");
        let res = format
            .replace(/\{song_name\}/g, p.songName || "")
            .replace(/\{song_author\}/g, p.songAuthor || "")
            .replace(/\{lyrics\}/g, effectiveLyrics);
        return res.replace(/[\s\-_–—]+$/, "").trim();
    }

    const DEFAULT_COVER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300' viewBox='0 0 300 300'%3E%3Crect width='300' height='300' fill='%2318181b'/%3E%3Ccircle cx='150' cy='150' r='50' fill='%231db954'/%3E%3Cpath d='M125 140c15-4 35-2 50 6M128 155c12-3 28-1 40 5M132 170c10-2 22 0 32 5' stroke='%23000' stroke-width='4' stroke-linecap='round' fill='none'/%3E%3C/svg%3E";

    function updatePlaybackUI(playback) {
        currentPlayback = playback || {};
        const p = currentPlayback;
        const now = Date.now();
        const isFresh = p.updatedAt > 0 && now - p.updatedAt < 5000;
        const hasData = !!(p.songName && p.songName.trim().length > 0);

        updateSpicetifyStatusUI({ ready: isFresh || p.active });

        const coverUrl = p.imageUrl || DEFAULT_COVER;

        if (hasData) {
            elTrackTitle.textContent = p.songName;
            elTrackArtist.textContent = p.songAuthor || "Nieznany wykonawca";
            if (elTrackCover.src !== coverUrl) {
                elTrackCover.src = coverUrl;
            }
            
            if (p.active) {
                elPlaybackPill.textContent = "Odtwarzanie";
                elPlaybackPill.className = "playback-pill playing";
            } else {
                elPlaybackPill.textContent = "Wstrzymano";
                elPlaybackPill.className = "playback-pill";
            }

            elTimeCurrent.textContent = formatTime(p.progressMs);
            elTimeTotal.textContent = formatTime(p.durationMs);

            const pct = p.durationMs > 0 ? Math.min(100, Math.max(0, (p.progressMs / p.durationMs) * 100)) : 0;
            elProgressBar.style.width = `${pct}%`;

            if (p.lyrics) {
                elLyricsCurrent.textContent = p.lyrics;
                elLyricsCurrent.style.color = "#4ade80";
                elLyricsSource.textContent = `źródło: ${p.source || "LrcLib"}`;
            } else {
                elLyricsCurrent.textContent = "♪ (Brak tekstu w tym momencie utworu)";
                elLyricsCurrent.style.color = "#a1a1aa";
                elLyricsSource.textContent = `źródło: ${p.source || "brak"}`;
            }

            const fmtName = currentConfig.discord?.format?.name || cfgFormatName.value || "{song_name} - {lyrics}";
            const fmtDetails = currentConfig.discord?.format?.details || cfgFormatDetails.value || "{song_name} - {song_author}";
            const fmtState = currentConfig.discord?.format?.state || cfgFormatState.value || "{lyrics}";

            elDiscordAppName.textContent = applyFormat(fmtName, p) || p.songName;
            elDiscordLine1.textContent = applyFormat(fmtDetails, p) || `${p.songName} - ${p.songAuthor}`;
            elDiscordLine2.textContent = applyFormat(fmtState, p) || (p.lyrics || "🎵 Słucha muzyki");
            
            const discordImg = (currentConfig.discord?.customLargeImage || (cfgCustomLargeImage ? cfgCustomLargeImage.value.trim() : "")) || coverUrl;
            if (elDiscordLargeImg.src !== discordImg) {
                elDiscordLargeImg.src = discordImg;
            }

            elDiscordTime.textContent = `${formatTime(p.progressMs)} z ${formatTime(p.durationMs)}`;
        } else {
            elTrackTitle.textContent = "Brak odtwarzanego utworu";
            elTrackArtist.textContent = "Uruchom utwór w Spotify";
            if (elTrackCover.src !== DEFAULT_COVER) {
                elTrackCover.src = DEFAULT_COVER;
            }
            elPlaybackPill.textContent = "Brak";
            elPlaybackPill.className = "playback-pill";
            elProgressBar.style.width = "0%";
            elLyricsCurrent.textContent = "♪ Czekam na odtworzenie utworu...";
            elLyricsCurrent.style.color = "#71717a";
            elLyricsSource.textContent = "źródło: brak";

            const fmtName = currentConfig.discord?.format?.name || cfgFormatName.value || "{song_name} - {lyrics}";
            const fmtDetails = currentConfig.discord?.format?.details || cfgFormatDetails.value || "{song_name} - {song_author}";
            const fmtState = currentConfig.discord?.format?.state || cfgFormatState.value || "{lyrics}";

            const dummy = { songName: "Tytuł utworu", songAuthor: "Wykonawca", lyrics: "Przykładowy wers tekstu", active: true };
            elDiscordAppName.textContent = applyFormat(fmtName, dummy);
            elDiscordLine1.textContent = applyFormat(fmtDetails, dummy);
            elDiscordLine2.textContent = applyFormat(fmtState, dummy);
            if (elDiscordLargeImg.src !== DEFAULT_COVER) {
                elDiscordLargeImg.src = DEFAULT_COVER;
            }
            elDiscordTime.textContent = "0:00 z 0:00";
        }
    }

    function populateConfigForm(config) {
        currentConfig = config || {};
        if (config.discord?.format?.name) cfgFormatName.value = config.discord.format.name;
        if (config.discord?.format?.details) cfgFormatDetails.value = config.discord.format.details;
        if (config.discord?.format?.state) cfgFormatState.value = config.discord.format.state;
        if (config.discord?.showTimestamps !== undefined) cfgShowTimestamps.checked = config.discord.showTimestamps;
        if (config.discord?.showAlbumArt !== undefined && cfgShowAlbumArt) cfgShowAlbumArt.checked = config.discord.showAlbumArt;
        if (config.discord?.customLargeImage !== undefined && cfgCustomLargeImage) cfgCustomLargeImage.value = config.discord.customLargeImage || "";
        if (config.discord?.clientId && cfgClientId && !clientIdDirty) cfgClientId.value = config.discord.clientId;
    }

    function connectWs() {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/ws`;

        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log("[WS] Connected to dashboard server");
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === "INIT") {
                    updateDiscordStatusUI(msg.discord);
                    if (msg.spicetify) updateSpicetifyStatusUI(msg.spicetify);
                    updatePlaybackUI(msg.playback);
                    populateConfigForm(msg.config);
                } else if (msg.type === "PLAYBACK_UPDATE") {
                    updatePlaybackUI(msg.playback);
                    updateSpicetifyStatusUI({ ready: true, connected: true });
                } else if (msg.type === "STATUS_UPDATE" || msg.type === "DISCORD_STATUS") {
                    if (msg.discord) updateDiscordStatusUI(msg.discord);
                    if (msg.spicetify) updateSpicetifyStatusUI(msg.spicetify);
                } else if (msg.type === "CONFIG_UPDATE") {
                    populateConfigForm(msg.config);
                }
            } catch (e) {}
        };

        ws.onclose = () => {
            console.log("[WS] Disconnected, reconnecting in 2s...");
            setTimeout(connectWs, 2000);
        };
    }

    async function pollHttp() {
        try {
            const res = await fetch("/api/status", { cache: "no-store" });
            if (res.ok) {
                const data = await res.json();
                if (data.playback) updatePlaybackUI(data.playback);
                if (data.discord) updateDiscordStatusUI(data.discord);
                if (data.spicetify) updateSpicetifyStatusUI(data.spicetify);
            }
        } catch (e) {
            updateDiscordStatusUI({ ready: false, connected: false });
            updateSpicetifyStatusUI({ ready: false, connected: false });
        }
    }

    configForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const updatedConfig = {
            discord: {
                ...currentConfig.discord,
                clientId: cfgClientId ? cfgClientId.value.trim() : (currentConfig.discord?.clientId || ""),
                showTimestamps: cfgShowTimestamps ? cfgShowTimestamps.checked : true,
                showAlbumArt: cfgShowAlbumArt ? cfgShowAlbumArt.checked : true,
                customLargeImage: (cfgCustomLargeImage ? cfgCustomLargeImage.value.trim() : ""),
                format: {
                    ...currentConfig.discord?.format,
                    name: (cfgFormatName ? cfgFormatName.value.trim() : "{song_name} - {lyrics}"),
                    details: (cfgFormatDetails ? cfgFormatDetails.value.trim() : "{song_name} - {song_author}"),
                    state: (cfgFormatState ? cfgFormatState.value.trim() : "{lyrics}")
                }
            }
        };

        try {
            const res = await fetch("/api/config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updatedConfig)
            });

            if (res.ok) {
                clientIdDirty = false;
                alert("Ustawienia zostały pomyślnie zapisane!");
            } else {
                alert("Błąd podczas zapisywania konfiguracji.");
            }
        } catch (e) {
            alert("Błąd połączenia z serwerem: " + e.message);
        }
    });

    connectWs();
    pollHttp();
    setInterval(pollHttp, 3000);
})();
