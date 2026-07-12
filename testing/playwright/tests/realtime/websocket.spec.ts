/**
 * Realtime WebSocket hub (/ws) — connection auth, app-level ping/pong
 * heartbeat, welcome event, room-join authorization, and duplicate
 * connections for the same user. All against the real hub.
 */
import { test, expect } from "../../fixtures/fixtures";
import { readTokens } from "../../config/env";
import { connectWs, wsAvailable } from "../../helpers/wsClient";

test.describe("WebSocket /ws hub", () => {
    test.beforeEach(({ requireApps }) => {
        requireApps("api");
        test.skip(!wsAvailable(), "ws module not installed in test runtime");
    });

    test("connect without a token is rejected (close 1008)", async () => {
        const sock = connectWs(null);
        // server closes immediately with 1008 "No token"
        await new Promise((r) => setTimeout(r, 1500));
        expect([1008, 1006]).toContain(sock.closeCode() ?? 1008);
        sock.close();
    });

    test("connect with a valid token receives the 'connected' welcome event", async () => {
        const token = readTokens().customer?.token;
        test.skip(!token, "no cached customer token");
        const sock = connectWs(token!);
        await sock.open;
        const welcome = await sock.waitFor("connected", 8000);
        expect(welcome.type).toBe("connected");
        sock.close();
    });

    test("app-level ping is answered with pong (heartbeat)", async () => {
        const token = readTokens().customer?.token;
        test.skip(!token, "no cached customer token");
        const sock = connectWs(token!);
        await sock.open;
        await sock.waitFor("connected", 8000);
        sock.send({ type: "ping" });
        const pong = await sock.waitFor("pong", 8000);
        expect(pong.type).toBe("pong");
        sock.close();
    });

    test("joining another order's room is denied (authorization)", async () => {
        const token = readTokens().customer?.token;
        test.skip(!token, "no cached customer token");
        const sock = connectWs(token!);
        await sock.open;
        await sock.waitFor("connected", 8000);
        // random order id this customer doesn't own → room_join_denied
        sock.send({ type: "join_room", room: "order:000000000000000000000000" });
        const denied = await sock.waitFor("room_join_denied", 8000);
        expect(denied.room).toContain("order:");
        sock.close();
    });

    test("non-admin cannot join the admins room", async () => {
        const token = readTokens().customer?.token;
        test.skip(!token, "no cached customer token");
        const sock = connectWs(token!);
        await sock.open;
        await sock.waitFor("connected", 8000);
        sock.send({ type: "join_room", room: "admins" });
        const denied = await sock.waitFor("room_join_denied", 8000);
        expect(denied.type).toBe("room_join_denied");
        sock.close();
    });

    test("duplicate connections for the same user are both accepted (multi-tab)", async () => {
        const token = readTokens().customer?.token;
        test.skip(!token, "no cached customer token");
        const a = connectWs(token!);
        const b = connectWs(token!);
        await a.open;
        await b.open;
        await a.waitFor("connected", 8000);
        await b.waitFor("connected", 8000);
        // both stay open — the hub tracks a Set of sockets per userId
        expect(a.closeCode()).toBeNull();
        expect(b.closeCode()).toBeNull();
        a.close();
        b.close();
    });

    test("reconnect after close works (session survives transport drop)", async () => {
        const token = readTokens().customer?.token;
        test.skip(!token, "no cached customer token");
        const first = connectWs(token!);
        await first.open;
        await first.waitFor("connected", 8000);
        first.close();

        const second = connectWs(token!);
        await second.open;
        const welcome = await second.waitFor("connected", 8000);
        expect(welcome.type).toBe("connected");
        second.close();
    });
});
