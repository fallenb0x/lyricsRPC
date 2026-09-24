import { spawn, ChildProcess } from "child_process";
import readline from "readline";

export interface NativeMediaPlayback {
    app: string;
    title: string;
    artist: string;
    albumTitle?: string;
    albumArtist?: string;
    status: "Playing" | "Paused" | "Stopped" | "Closed";
    positionMs: number;
    durationMs: number;
    updatedAt: number;
}

export class WindowsMediaWatcher {
    private process: ChildProcess | null = null;
    private onMediaChangeCallback?: (media: NativeMediaPlayback) => void;
    private lastMedia: NativeMediaPlayback | null = null;
    private isRunning = false;

    private readonly psScript = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]
Function Await($WinRtTask, $ResultType) {
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.Wait(1000) | Out-Null
    $netTask.Result
}

[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media.Control,ContentType=WindowsRuntime] | Out-Null
$asyncOp = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()
$manager = Await $asyncOp ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])

$lastRaw = ""

while ($true) {
    try {
        $sessions = $manager.GetSessions()
        $found = $null
        foreach ($s in $sessions) {
            if ($s.SourceAppUserModelId -match "Spotify") {
                $found = $s
                break
            }
        }

        if ($found) {
            $media = Await ($found.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
            $timeline = $found.GetTimelineProperties()
            $playback = $found.GetPlaybackInfo()
            
            $obj = @{
                app = "Spotify"
                title = if ($media) { $media.Title } else { "" }
                artist = if ($media) { $media.Artist } else { "" }
                albumTitle = if ($media) { $media.AlbumTitle } else { "" }
                albumArtist = if ($media) { $media.AlbumArtist } else { "" }
                status = if ($playback) { $playback.PlaybackStatus.ToString() } else { "Stopped" }
                positionMs = if ($timeline) { [Math]::Round($timeline.Position.TotalMilliseconds) } else { 0 }
                durationMs = if ($timeline) { [Math]::Round($timeline.EndTime.TotalMilliseconds) } else { 0 }
            }
            $json = ConvertTo-Json -Compress $obj
            if ($json -ne $lastRaw) {
                $lastRaw = $json
                Write-Output $json
            }
        } else {
            $json = '{"app":"Spotify","status":"Stopped","title":"","artist":"","albumTitle":"","albumArtist":"","positionMs":0,"durationMs":0}'
            if ($json -ne $lastRaw) {
                $lastRaw = $json
                Write-Output $json
            }
        }
    } catch {}
    Start-Sleep -Milliseconds 250
}
`;

    public onMediaChange(cb: (media: NativeMediaPlayback) => void) {
        this.onMediaChangeCallback = cb;
    }

    public start(): void {
        if (this.isRunning) return;
        this.isRunning = true;

        this.process = spawn("powershell", [
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            this.psScript
        ], {
            windowsHide: true,
            stdio: ["ignore", "pipe", "ignore"]
        });

        if (this.process.stdout) {
            this.process.stdout.setEncoding("utf8");
            const rl = readline.createInterface({ input: this.process.stdout });
            rl.on("line", (line) => {
                try {
                    const trimmed = line.trim();
                    if (!trimmed || !trimmed.startsWith("{")) return;
                    const json = JSON.parse(trimmed);
                    const now = Date.now();
                    const media: NativeMediaPlayback = {
                        app: json.app || "Spotify",
                        title: json.title || "",
                        artist: json.artist || "",
                        albumTitle: json.albumTitle || "",
                        albumArtist: json.albumArtist || "",
                        status: json.status || "Stopped",
                        positionMs: Number(json.positionMs || 0),
                        durationMs: Number(json.durationMs || 0),
                        updatedAt: now
                    };

                    this.lastMedia = media;
                    if (this.onMediaChangeCallback) {
                        this.onMediaChangeCallback(media);
                    }
                } catch {}
            });
        }

        this.process.on("exit", () => {
            if (this.isRunning) {
                setTimeout(() => this.start(), 1000);
            }
        });
    }

    public stop(): void {
        this.isRunning = false;
        if (this.process) {
            try { this.process.kill(); } catch {}
            this.process = null;
        }
    }
}
