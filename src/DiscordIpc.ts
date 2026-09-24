import net from "net";
import crypto from "crypto";

export interface DiscordActivity {
    type?: number;
    name?: string;
    details?: string;
    state?: string;
    timestamps?: { start?: number; end?: number };
    assets?: {
        large_image?: string;
        large_text?: string;
        small_image?: string;
        small_text?: string;
    };
    buttons?: { label: string; url: string }[];
}

enum Opcode {
    Handshake = 0,
    Frame     = 1,
    Close     = 2,
    Ping      = 3,
    Pong      = 4,
}


export class DiscordIpcClient {
    private clientId: string;
    private socket: net.Socket | null = null;
    private connected = false;
    private ready = false;
    private reconnectTimer: NodeJS.Timeout | null = null;

    private recvBuffer = Buffer.alloc(0);

    private onReadyCallback?: (user: any) => void;
    private onStatusCallback?: (connected: boolean, ready: boolean) => void;
    public currentUser: any = null;

    constructor(clientId: string) {
        this.clientId = clientId;
    }

    public updateClientId(newId: string): void {
        if (newId === this.clientId) return;
        this.clientId = newId;
        if (!newId) {
            this.clearActivity();
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }
            if (this.socket) {
                this.socket.destroy();
                this.socket = null;
            }
            this.connected = false;
            this.ready = false;
            this.currentUser = null;
            this.notifyStatus();
            return;
        }
        this.connect();
    }

    public onReady(cb: (user: any) => void)                         { this.onReadyCallback  = cb; }
    public onStatusChange(cb: (c: boolean, r: boolean) => void)    { this.onStatusCallback = cb; }
    public isReady(): boolean    { return this.connected && this.ready; }
    public isConnected(): boolean { return this.connected; }

    public setActivity(activity: DiscordActivity | null): void {
        if (!this.isReady()) return;
        const args: { pid: number; activity?: DiscordActivity } = { pid: process.pid };
        if (activity) {
            args.activity = activity;
        }
        this.sendFrame({
            cmd: "SET_ACTIVITY",
            args: args,
            nonce: crypto.randomUUID(),
        });
    }

    public clearActivity(): void {
        this.setActivity(null);
    }

    private isConnecting = false;

    public connect(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.socket) {
            try { this.socket.destroy(); } catch {}
            this.socket = null;
        }
        this.connected = false;
        this.ready     = false;
        this.recvBuffer = Buffer.alloc(0);
        this.isConnecting = true;
        this.tryPipe(0);
    }

    private tryPipe(index: number): void {
        if (index > 9) {
            this.isConnecting = false;
            this.scheduleReconnect();
            return;
        }

        const pipePath = `\\\\.\\pipe\\discord-ipc-${index}`;
        const sock = net.createConnection(pipePath);

        let isEstablished = false;

        sock.once("connect", () => {
            isEstablished = true;
            this.isConnecting = false;
            this.socket = sock;
            this.connected = true;
            this.notifyStatus();
            this.sendHandshake();
        });

        sock.on("data", (chunk: Buffer) => this.onData(chunk));

        sock.once("error", () => {
            if (!isEstablished) {
                sock.destroy();
                this.tryPipe(index + 1);
            } else {
                sock.destroy();
                this.scheduleReconnect();
            }
        });

        sock.once("close", () => {
            if (isEstablished && this.socket === sock) {
                this.scheduleReconnect();
            }
        });
    }

    private scheduleReconnect(): void {
        if (this.reconnectTimer) return;
        this.connected  = false;
        this.ready      = false;
        this.currentUser = null;
        this.recvBuffer = Buffer.alloc(0);
        this.notifyStatus();

        if (this.socket) {
            try { this.socket.destroy(); } catch {}
            this.socket = null;
        }

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, 3000);
    }

    private sendPacket(opcode: Opcode, payload: object): void {
        if (!this.socket || !this.connected) return;
        try {
            const json = JSON.stringify(payload);
            const jsonBuf = Buffer.from(json, "utf8");
            const header  = Buffer.alloc(8);
            header.writeInt32LE(opcode,          0);
            header.writeInt32LE(jsonBuf.length,  4);
            this.socket.write(Buffer.concat([header, jsonBuf]));
        } catch {}
    }

    private sendHandshake(): void {
        this.sendPacket(Opcode.Handshake, { v: 1, client_id: this.clientId });
    }

    private sendFrame(payload: object): void {
        this.sendPacket(Opcode.Frame, payload);
    }


    private onData(chunk: Buffer): void {
        this.recvBuffer = Buffer.concat([this.recvBuffer, chunk]);

        while (this.recvBuffer.length >= 8) {
            const opcode  = this.recvBuffer.readInt32LE(0);
            const length  = this.recvBuffer.readInt32LE(4);

            if (this.recvBuffer.length < 8 + length) break;

            const jsonBuf  = this.recvBuffer.subarray(8, 8 + length);
            this.recvBuffer = this.recvBuffer.subarray(8 + length);

            try {
                const body = JSON.parse(jsonBuf.toString("utf8"));
                this.handleFrame(opcode, body);
            } catch {}
        }
    }

    private handleFrame(opcode: number, body: any): void {
        switch (opcode) {
            case Opcode.Frame:
                this.handleRpcMessage(body);
                break;
            case Opcode.Close:
                this.scheduleReconnect();
                break;
            case Opcode.Ping:
                this.sendPacket(Opcode.Pong, body);
                break;
        }
    }

    private handleRpcMessage(body: any): void {
        const { cmd, evt } = body;

        if (cmd === "DISPATCH" && evt === "READY") {
            this.ready       = true;
            this.currentUser = body.data?.user ?? null;
            this.notifyStatus();
            if (this.onReadyCallback) this.onReadyCallback(this.currentUser);
            return;
        }

        if (evt === "ERROR") {
            console.error("[IPC] Discord error:", body.data?.message ?? body);
        }
    }


    private lastNotifiedState = "";
    private notifyStatus(): void {
        const key = `${this.connected}:${this.ready}:${this.currentUser?.id ?? ""}`;
        if (key !== this.lastNotifiedState) {
            this.lastNotifiedState = key;
            this.onStatusCallback?.(this.connected, this.ready);
        }
    }
}
