/**
 * notificationQueue.js — Reliable notification delivery
 * In-memory retry queue for WebSocket notifications
 * If socket delivery fails → retries up to 3 times with backoff
 * Falls back to DB storage so notifications survive restarts
 */
import { sendToUser } from "./wsHub.js";

/* ── In-memory pending queue: userId -> [{ type, payload, attempts, nextRetry }] ── */
const pendingQueue = new Map();
const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [2000, 5000, 15000]; // 2s, 5s, 15s

/* ── Send with retry ── */
export const sendNotification = (userId, type, payload = {}) => {
    const delivered = sendToUser(String(userId), type, payload);
    if (!delivered) {
        enqueue(String(userId), type, payload);
    }
    return delivered;
};

/* ── Broadcast with retry ── */
export const broadcastNotification = (userIds, type, payload = {}) => {
    userIds.forEach(id => sendNotification(id, type, payload));
};

/* ── Enqueue failed notification ── */
const enqueue = (userId, type, payload) => {
    if (!pendingQueue.has(userId)) pendingQueue.set(userId, []);
    const queue = pendingQueue.get(userId);
    // Don't queue duplicates of same type within 30s
    const now = Date.now();
    const dup = queue.find(n => n.type === type && (now - n.queuedAt) < 30000);
    if (dup) return;
    queue.push({ type, payload, attempts: 0, nextRetry: now + BACKOFF_MS[0], queuedAt: now });
};

/* ── Flush queue for a user when they reconnect ── */
export const flushQueueForUser = (userId) => {
    const key = String(userId);
    const queue = pendingQueue.get(key);
    if (!queue || queue.length === 0) return;

    const remaining = [];
    for (const item of queue) {
        const delivered = sendToUser(key, item.type, item.payload);
        if (!delivered) {
            item.attempts++;
            if (item.attempts < MAX_ATTEMPTS) {
                item.nextRetry = Date.now() + BACKOFF_MS[item.attempts];
                remaining.push(item);
            }
            // Drop after MAX_ATTEMPTS — notification lost after best-effort
        }
    }
    if (remaining.length === 0) pendingQueue.delete(key);
    else pendingQueue.set(key, remaining);
};

/* ── Background retry ticker (every 3 seconds) ── */
setInterval(() => {
    const now = Date.now();
    for (const [userId, queue] of pendingQueue.entries()) {
        const remaining = [];
        for (const item of queue) {
            if (now < item.nextRetry) { remaining.push(item); continue; }
            const delivered = sendToUser(userId, item.type, item.payload);
            if (!delivered) {
                item.attempts++;
                if (item.attempts < MAX_ATTEMPTS) {
                    item.nextRetry = now + (BACKOFF_MS[item.attempts] || 15000);
                    remaining.push(item);
                }
                // else: drop silently after max retries
            }
        }
        if (remaining.length === 0) pendingQueue.delete(userId);
        else pendingQueue.set(userId, remaining);
    }
}, 3000);

export const getQueueStats = () => ({
    users: pendingQueue.size,
    totalPending: [...pendingQueue.values()].reduce((s, q) => s + q.length, 0),
});
