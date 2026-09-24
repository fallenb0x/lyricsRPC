import { spawn, ChildProcess, exec } from "child_process";
import fs from "fs";
import path from "path";

export class TrayManager {
    private trayProcess: ChildProcess | null = null;
    private onExitCallback?: () => void;
    private port: number = 8999;

    constructor(port: number, onExitCallback?: () => void) {
        this.port = port;
        this.onExitCallback = onExitCallback;
    }

    public start(): void {
        const psScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$notify = New-Object System.Windows.Forms.NotifyIcon
$notify.Text = "LyricsRPC"

$iconPath = "${path.join(process.cwd(), "static", "logo.png").replace(/\\/g, "\\\\")}"
$setCustomIcon = $false

if (Test-Path $iconPath) {
    try {
        $bmp = [System.Drawing.Bitmap]::FromFile($iconPath)
        $hIcon = $bmp.GetHicon()
        $notify.Icon = [System.Drawing.Icon]::FromHandle($hIcon)
        $setCustomIcon = $true
    } catch {}
}

if (-not $setCustomIcon) {
    $notify.Icon = [System.Drawing.SystemIcons]::Application
}

$notify.Visible = $true

$contextMenu = New-Object System.Windows.Forms.ContextMenuStrip
$openItem = $contextMenu.Items.Add("Otwórz LyricsRPC")
$openItem.Font = New-Object System.Drawing.Font($openItem.Font, [System.Drawing.FontStyle]::Bold)
$sepItem = $contextMenu.Items.Add("-")
$exitItem = $contextMenu.Items.Add("Wyłącz")

$openItem.add_Click({
    [Console]::WriteLine("ACTION:OPEN")
})

$exitItem.add_Click({
    [Console]::WriteLine("ACTION:EXIT")
    $notify.Visible = $false
    [System.Windows.Forms.Application]::Exit()
})

$notify.ContextMenuStrip = $contextMenu

$notify.add_DoubleClick({
    [Console]::WriteLine("ACTION:OPEN")
})

$notify.add_Click({
    param($s, $e)
    if ($e.Button -eq [System.Windows.Forms.MouseButtons]::Left) {
        [Console]::WriteLine("ACTION:OPEN")
    }
})

[System.Windows.Forms.Application]::Run()
`;

        this.trayProcess = spawn("powershell.exe", ["-NoProfile", "-WindowStyle", "Hidden", "-Command", psScript], {
            stdio: ["ignore", "pipe", "ignore"],
            windowsHide: true
        });

        if (this.trayProcess.stdout) {
            let buffer = "";
            this.trayProcess.stdout.on("data", (chunk: Buffer) => {
                buffer += chunk.toString("utf8");
                const lines = buffer.split(/\r?\n/);
                buffer = lines.pop() || "";

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed === "ACTION:OPEN") {
                        this.openAppWindow();
                    } else if (trimmed === "ACTION:EXIT") {
                        this.stop();
                        if (this.onExitCallback) {
                            this.onExitCallback();
                        } else {
                            process.exit(0);
                        }
                    }
                }
            });
        }
    }

    public stop(): void {
        if (this.trayProcess) {
            try {
                this.trayProcess.kill();
            } catch {}
            this.trayProcess = null;
        }
    }

    public openAppWindow(): void {
        const url = `http://localhost:${this.port}`;
        const browserPath = this.detectChromiumBrowser();

        if (browserPath) {
            exec(`"${browserPath}" --app="${url}" --window-size=1040,760`, (err) => {
                if (err) {
                    exec(`start ${url}`);
                }
            });
        } else {
            exec(`start ${url}`);
        }
    }

    private detectChromiumBrowser(): string | null {
        const candidates = [
            path.join(process.env["ProgramFiles"] || "C:\\Program Files", "Microsoft\\Edge\\Application\\msedge.exe"),
            path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Microsoft\\Edge\\Application\\msedge.exe"),
            path.join(process.env["ProgramFiles"] || "C:\\Program Files", "Google\\Chrome\\Application\\chrome.exe"),
            path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Google\\Chrome\\Application\\chrome.exe"),
            path.join(process.env["LOCALAPPDATA"] || "", "Microsoft\\Edge\\Application\\msedge.exe"),
            path.join(process.env["LOCALAPPDATA"] || "", "Google\\Chrome\\Application\\chrome.exe"),
            path.join(process.env["ProgramFiles"] || "C:\\Program Files", "BraveSoftware\\Brave-Browser\\Application\\brave.exe"),
            path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "BraveSoftware\\Brave-Browser\\Application\\brave.exe")
        ];

        for (const c of candidates) {
            if (c && fs.existsSync(c)) {
                return c;
            }
        }

        return null;
    }
}
