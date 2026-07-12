/**
 * Minimal WebSocket test client for the real /ws hub.
 * Uses the browser-global WebSocket available in Playwright's Node runtime
 * via the `ws` package shipped with @playwright/test's dependencies is NOT
 * guaranteed, so we lazily require it and skip if unavailable.
 */
import { ENV } from "../config/env";

export type WsMsg = { type?: string;[k: string]: any };

export interface TestSocket {
    open: Promise<void>;
    messages: WsMsg[];
    waitFor: (type: string, timeoutMs?: number) => Promise<WsMsg>;
    send: (obj: unknown) => void;
    close: () => void;
    closeCode: () => number | null;
}

let WSImpl: any = null;
try {
    // ws is a transitive dep of Playwright; if absent, tests skip.
    WSImpl = require("ws");
} catch {
    WSImpl = null;
}

export const wsAvailable = () => WSImpl !== null;

export const connectWs = (token: string | null, origin = ENV.clientUrl): TestSocket => {
    if (!WSImpl) throw new Error("ws module unavailable");
    const url = `${ENV.wsUrl}${token ? `?token=${encodeURIComponent(token)}` : ""}`;
    const socket = new WSImpl(url, { headers: { Origin: origin } });
    const messages: WsMsg[] = [];
    let closeCode: number | null = null;

    const open = new Promise<void>((resolve, reject) => {
        socket.on("open", () => resolve());
        socket.on("error", (e: Error) => reject(e));
        socket.on("close", (code: number) => { closeCode = code; });
    });

    socket.on("message", (raw: Buffer) => {
        try { messages.push(JSON.parse(raw.toString())); } catch { /* non-JSON frame */ }
    });

    const waitFor = (type: string, timeoutMs = 8000) =>
        new Promise<WsMsg>((resolve, reject) => {
            const existing = messages.find(m => m.type === type);
            if (existing) return resolve(existing);
            const timer = setTimeout(() => reject(new Error(`timeout waiting for "${type}"`)), timeoutMs);
            socket.on("message", (raw: Buffer) => {
                try {
                    const m = JSON.parse(raw.toString());
                    if (m.type === type) { clearTimeout(timer); resolve(m); }
                } catch { /* ignore */ }
            });
        });

    return {
        open,
        messages,
        waitFor,
        send: (obj) => socket.send(JSON.stringify(obj)),
        close: () => socket.close(),
        closeCode: () => closeCode,
    };
};
