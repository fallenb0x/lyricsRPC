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
    const elDiscordBtn = document.getElementById("discord-btn");

    const configForm = document.getElementById("config-form");
    const cfgFormatName = document.getElementById("cfg-format-name");
    const cfgFormatDetails = document.getElementById("cfg-format-details");
    const cfgFormatState = document.getElementById("cfg-format-state");
    const cfgShowTimestamps = document.getElementById("cfg-show-timestamps");
    const cfgShowButtons = document.getElementById("cfg-show-buttons");
    const cfgShowAlbumArt = document.getElementById("cfg-show-album-art");
    const cfgCustomLargeImage = document.getElementById("cfg-custom-large-image");

    function formatTime(ms) {
        if (!ms || isNaN(ms)) return "0:00";
        const totalSec = Math.floor(ms / 1000);
        const mins = Math.floor(totalSec / 60);
        const secs = totalSec % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    function updateDiscordStatusUI(discord) {
        currentDiscord = discord || {};
        if (currentDiscord.ready) {
            elBadgeDiscord.className = "badge badge-online";
            elBadgeDiscord.innerHTML = `<span class="dot"></span><span class="label">Discord: ${currentDiscord.user?.username || "Połączono"}</span>`;
        } else if (currentDiscord.connected) {
            elBadgeDiscord.className = "badge badge-online";
            elBadgeDiscord.innerHTML = `<span class="dot"></span><span class="label">Discord: Łączenie...</span>`;
        } else {
            elBadgeDiscord.className = "badge badge-offline";
            elBadgeDiscord.innerHTML = `<span class="dot"></span><span class="label">Discord: Rozłączono</span>`;
        }
    }

    function updateSpicetifyStatusUI(spicetify) {
        const online = spicetify?.ready || spicetify?.connected || false;
        if (online) {
            elBadgeSpicetify.className = "badge badge-online";
            elBadgeSpicetify.innerHTML = `<span class="dot"></span><span class="label">Spicetify: Aktywne</span>`;
        } else {
            elBadgeSpicetify.className = "badge badge-offline";
            elBadgeSpicetify.innerHTML = `<span class="dot"></span><span class="label">Spicetify: Oczekiwanie</span>`;
        }
    }

    function applyFormat(format, p) {
        if (!format) return "";
        const effectiveLyrics = p.lyrics || (p.active ? "♪ (Brak tekstu)" : "");
        let res = format
            .replace(/\{song_name\}/g, p.songName || "")
            .replace(/\{song_author\}/g, p.songAuthor || "")
            .replace(/\{lyrics\}/g, effectiveLyrics);
        return res.replace(/[\s\-_–—]+$/, "").trim();
    }

    const DEFAULT_COVER = "https://via.placeholder.com/300x300/18181b/52525b?text=Spotify";

    function updatePlaybackUI(playback) {
        currentPlayback = playback || {};
        const p = currentPlayback;
        const now = Date.now();
        const isFresh = p.updatedAt > 0 && now - p.updatedAt < 5000;
        // hasData: show cover/track info even when paused (updatedAt may be old)
        const hasData = !!(p.songName);

        if (isFresh) {
            elBadgeSpicetify.className = "badge badge-online";
            elBadgeSpicetify.innerHTML = `<span class="dot"></span><span class="label">Spicetify: Aktywne</span>`;
        } else {
            elBadgeSpicetify.className = "badge badge-offline";
            elBadgeSpicetify.innerHTML = `<span class="dot"></span><span class="label">Spicetify: Oczekiwanie</span>`;
        }

        const coverUrl = p.imageUrl || DEFAULT_COVER;

        if (hasData) {
            elTrackTitle.textContent = p.songName;
            elTrackArtist.textContent = p.songAuthor || "Nieznany wykonawca";
            elTrackCover.src = coverUrl;
            
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
                elLyricsSource.textContent = `źródło: ${p.source || "lucid-lyrics"}`;
            } else {
                elLyricsCurrent.textContent = "♪ (Brak tekstu w tym momencie utworu)";
                elLyricsCurrent.style.color = "#a1a1aa";
                elLyricsSource.textContent = `źródło: ${p.source || "brak"}`;
            }

            // Update Discord Preview with user custom format
            const fmtName = currentConfig.discord?.format?.name || cfgFormatName.value || "{song_name} - {lyrics}";
            const fmtDetails = currentConfig.discord?.format?.details || cfgFormatDetails.value || "{song_name} - {song_author}";
            const fmtState = currentConfig.discord?.format?.state || cfgFormatState.value || "{lyrics}";

            elDiscordAppName.textContent = applyFormat(fmtName, p) || p.songName;
            elDiscordLine1.textContent = applyFormat(fmtDetails, p) || `${p.songName} - ${p.songAuthor}`;
            elDiscordLine2.textContent = applyFormat(fmtState, p) || (p.lyrics || "🎵 Słucha muzyki");
            elDiscordLargeImg.src = coverUrl;
            elDiscordTime.textContent = `${formatTime(p.progressMs)} z ${formatTime(p.durationMs)}`;
            elDiscordBtn.disabled = false;
        } else {
            elTrackTitle.textContent = "Brak odtwarzanego utworu";
            elTrackArtist.textContent = "Uruchom utwór w Spotify";
            elTrackCover.src = DEFAULT_COVER;
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
            elDiscordLargeImg.src = DEFAULT_COVER;
            elDiscordTime.textContent = "0:00 z 0:00";
            elDiscordBtn.disabled = true;
        }
    }

    function populateConfigForm(config) {
        currentConfig = config || {};
        if (config.discord?.format?.name) cfgFormatName.value = config.discord.format.name;
        if (config.discord?.format?.details) cfgFormatDetails.value = config.discord.format.details;
        if (config.discord?.format?.state) cfgFormatState.value = config.discord.format.state;
        if (config.discord?.showTimestamps !== undefined) cfgShowTimestamps.checked = config.discord.showTimestamps;
        if (config.discord?.showButtons !== undefined) cfgShowButtons.checked = config.discord.showButtons;
        if (config.discord?.showAlbumArt !== undefined) cfgShowAlbumArt.checked = config.discord.showAlbumArt;
        if (config.discord?.customLargeImage !== undefined) cfgCustomLargeImage.value = config.discord.customLargeImage || "";
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
                } else if (msg.type === "STATUS_UPDATE") {
                    updateDiscordStatusUI(msg.discord);
                    if (msg.spicetify) updateSpicetifyStatusUI(msg.spicetify);
                } else if (msg.type === "CONFIG_UPDATE") {
                    populateConfigForm(msg.config);
                }
            } catch (e) {}
        };

        ws.onclose = () => {
            console.log("[WS] Disconnected, reconnecting in 2s...");
            updateDiscordStatusUI({ ready: false, connected: false });
            updateSpicetifyStatusUI({ ready: false, connected: false });
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
            // fallback to /rpc directly
            try {
                const res2 = await fetch("/rpc", { cache: "no-store" });
                if (res2.ok) {
                    const p = await res2.json();
                    updatePlaybackUI(p);
                }
            } catch {}
        }
    }

    configForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const updatedConfig = {
            discord: {
                ...currentConfig.discord,
                showTimestamps: cfgShowTimestamps.checked,
                showButtons: cfgShowButtons.checked,
                showAlbumArt: cfgShowAlbumArt.checked,
                customLargeImage: cfgCustomLargeImage.value.trim(),
                format: {
                    ...currentConfig.discord?.format,
                    name: cfgFormatName.value.trim(),
                    details: cfgFormatDetails.value.trim(),
                    state: cfgFormatState.value.trim()
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
                alert("Ustawienia zostały pomyślnie zapisane!");
            } else {
                alert("Błąd podczas zapisywania konfiguracji.");
            }
        } catch (e) {
            alert("Błąd połączenia z serwerem: " + e.message);
        }
    });

    // Start WebSocket + HTTP polling
    connectWs();
    pollHttp();
    setInterval(pollHttp, 500);
})();
