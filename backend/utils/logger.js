/**
 * 📊 PRODUCTION LOGGER UTILITY
 * Centralized logging for all jobs and operations
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { captureMessage } from '../config/errorTracking.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOGS_DIR = path.join(__dirname, '../logs');
const LOG_LEVELS = {
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    SUCCESS: 'SUCCESS',
    WARN: 'WARN',
    ERROR: 'ERROR',
};

const LOG_COLORS = {
    DEBUG: '\x1b[36m',    // Cyan
    INFO: '\x1b[34m',     // Blue
    SUCCESS: '\x1b[32m',  // Green
    WARN: '\x1b[33m',     // Yellow
    ERROR: '\x1b[31m',    // Red
    RESET: '\x1b[0m',
};

class Logger {
    constructor() {
        this.initLogsDirectory();
    }

    async initLogsDirectory() {
        try {
            await fs.mkdir(LOGS_DIR, { recursive: true });
        } catch (err) {
            console.error('Failed to create logs directory:', err);
        }
    }

    getTimestamp() {
        return new Date().toISOString();
    }

    formatMessage(level, message, data = '') {
        const timestamp = this.getTimestamp();
        const dataStr = data ? ` | ${JSON.stringify(data)}` : '';
        return `[${timestamp}] [${level}] ${message}${dataStr}`;
    }

    printLog(level, message, data, color) {
        const formattedMsg = this.formatMessage(level, message, data);
        console.log(`${color}${formattedMsg}${LOG_COLORS.RESET}`);
        return formattedMsg;
    }

    async writeToFile(level, message, data) {
        try {
            const logFile = path.join(LOGS_DIR, `${level.toLowerCase()}.log`);
            const formattedMsg = this.formatMessage(level, message, data);
            await fs.appendFile(logFile, formattedMsg + '\n');
        } catch (err) {
            console.error(`Failed to write to log file:`, err);
        }
    }

    async log(level, message, data) {
        const color = LOG_COLORS[level] || LOG_COLORS.INFO;
        this.printLog(level, message, data, color);
        await this.writeToFile(level, message, data);
        // [FIX] Previously ERROR-level logs only ever reached a local,
        // ephemeral log file (lost on every restart/redeploy, never
        // aggregated) — now they also reach the same error tracker as
        // backend/frontend exceptions (config/errorTracking.js), a no-op
        // until SENTRY_DSN is set.
        if (level === LOG_LEVELS.ERROR) {
            captureMessage(message, data);
        }
    }

    async debug(message, data) {
        await this.log(LOG_LEVELS.DEBUG, message, data);
    }

    async info(message, data) {
        await this.log(LOG_LEVELS.INFO, message, data);
    }

    async success(message, data) {
        await this.log(LOG_LEVELS.SUCCESS, message, data);
    }

    async warn(message, data) {
        await this.log(LOG_LEVELS.WARN, message, data);
    }

    async error(message, data) {
        await this.log(LOG_LEVELS.ERROR, message, data);
    }
}

export default new Logger();
