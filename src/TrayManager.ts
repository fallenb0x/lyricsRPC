import { spawn, ChildProcess } from "child_process";
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
        const trayExePath = this.resolveTrayBinary();
        if (!trayExePath) return;

        try {
            this.trayProcess = spawn(trayExePath, [], {
                stdio: ["pipe", "pipe", "ignore"],
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
        } catch {}
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
            try {
                const child = spawn(browserPath, [
                    `--app=${url}`,
                    "--window-size=1040,760"
                ], {
                    detached: true,
                    stdio: "ignore"
                });
                child.unref();
            } catch {
                spawn("cmd.exe", ["/c", "start", url], {
                    detached: true,
                    stdio: "ignore",
                    windowsHide: true
                }).unref();
            }
        } else {
            spawn("cmd.exe", ["/c", "start", url], {
                detached: true,
                stdio: "ignore",
                windowsHide: true
            }).unref();
        }
    }

    private resolveTrayBinary(): string | null {
        const exeDir = path.dirname(process.execPath);
        const candidates = [
            path.join(process.cwd(), "LyricsTray.exe"),
            path.join(exeDir, "LyricsTray.exe"),
            path.join(exeDir, "build", "LyricsTray.exe"),
            path.join(process.cwd(), "build", "LyricsTray.exe"),
            path.join(__dirname, "LyricsTray.exe"),
            path.join(__dirname, "../build", "LyricsTray.exe")
        ];

        for (const c of candidates) {
            if (fs.existsSync(c)) return c;
        }

        return null;
    }

    private detectChromiumBrowser(): string | null {
        const localAppData = process.env["LOCALAPPDATA"] || "";
        const progFiles = process.env["ProgramFiles"] || "C:\\Program Files";
        const progFilesX86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
        const progW6432 = process.env["ProgramW6432"] || "C:\\Program Files";

        const candidates = [
            path.join(progFilesX86, "Microsoft\\Edge\\Application\\msedge.exe"),
            path.join(progFiles, "Microsoft\\Edge\\Application\\msedge.exe"),
            path.join(progW6432, "Microsoft\\Edge\\Application\\msedge.exe"),
            path.join(localAppData, "Microsoft\\Edge\\Application\\msedge.exe"),
            path.join(progFiles, "Google\\Chrome\\Application\\chrome.exe"),
            path.join(progFilesX86, "Google\\Chrome\\Application\\chrome.exe"),
            path.join(progW6432, "Google\\Chrome\\Application\\chrome.exe"),
            path.join(localAppData, "Google\\Chrome\\Application\\chrome.exe"),
            path.join(progFiles, "BraveSoftware\\Brave-Browser\\Application\\brave.exe"),
            path.join(progFilesX86, "BraveSoftware\\Brave-Browser\\Application\\brave.exe"),
            path.join(localAppData, "BraveSoftware\\Brave-Browser\\Application\\brave.exe")
        ];

        for (const c of candidates) {
            if (c && fs.existsSync(c)) {
                return c;
            }
        }

        return null;
    }
}
