import { Logger } from './logger';

interface ErrorRecord {
    count: number;
    lastLogged: number;
    firstSeen: number;
    message: string;
}

/**
 * Utility class for throttling repeated log messages
 */
export class LogThrottler {
    private static errorRecords: Map<string, ErrorRecord> = new Map();

    /**
     * Log a message with throttling to avoid flooding logs with repeated messages
     *
     * @param key - A unique identifier for the type of error (e.g. "instance-not-found-jupyter1")
     * @param message - The error message to log
     * @param level - Log level to use
     * @param throttleOptions - Options for controlling throttling behavior
     */
    public static throttledLog(
        key: string,
        message: string,
        level: 'error' | 'warn' | 'info' = 'error',
        throttleOptions: {
            initialLogInterval?: number;   // Time in ms between initial logs
            subsequentLogInterval?: number; // Time in ms between logs after repeated occurrences
            maxOccurrences?: number;       // After this many occurrences, reduce logging frequency
            summarizeInterval?: number;    // Time in ms to periodically summarize occurrences
        } = {}
    ): void {
        const now = Date.now();
        const options = {
            initialLogInterval: 60000,     // 1 minute
            subsequentLogInterval: 300000, // 5 minutes
            maxOccurrences: 10,           // After 10 occurrences, reduce logging frequency
            summarizeInterval: 1800000,   // Every 30 minutes, provide a summary
            ...throttleOptions
        };

        // Get or create record
        const record = this.errorRecords.get(key) || {
            count: 0,
            lastLogged: 0,
            firstSeen: now,
            message
        };

        // Increment counter
        record.count++;

        let shouldLog = false;

        // Always log the first occurrence
        if (record.count === 1) {
            shouldLog = true;
        }
        // For repeated occurrences, throttle logging based on frequency
        else {
            const timeSinceLastLog = now - record.lastLogged;
            const logInterval = record.count <= options.maxOccurrences
                ? options.initialLogInterval
                : options.subsequentLogInterval;

            // Log if enough time has passed since the last log
            if (timeSinceLastLog >= logInterval) {
                shouldLog = true;
            }

            // Periodically provide a summary regardless of regular throttling
            const timeSinceFirstSeen = now - record.firstSeen;
            if (timeSinceFirstSeen >= options.summarizeInterval &&
                (now - record.lastLogged) >= options.summarizeInterval) {
                shouldLog = true;
            }
        }

        if (shouldLog) {
            // For repeat occurrences, include count information
            const logMessage = record.count > 1
                ? `${message} (occurred ${record.count} times in the last ${this.formatDuration(now - record.firstSeen)})`
                : message;

            // Log at the appropriate level
            switch (level) {
                case 'error':
                    Logger.error(logMessage);
                    break;
                case 'warn':
                    Logger.warn(logMessage);
                    break;
                case 'info':
                    Logger.log(logMessage);
                    break;
            }

            record.lastLogged = now;
        }

        // Update record
        this.errorRecords.set(key, record);
    }

    /**
     * Reset the tracking for a specific error key
     */
    public static resetTracking(key: string): void {
        this.errorRecords.delete(key);
    }

    /**
     * Format a duration in milliseconds to a human-readable string
     */
    private static formatDuration(ms: number): string {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    /**
     * Extract meaningful error information from various error types
     */
    public static getErrorMessage(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        } else if (typeof error === 'string') {
            return error;
        } else if (error && typeof error === 'object') {
            try {
                return JSON.stringify(error);
            } catch {
                return String(error);
            }
        } else {
            return String(error);
        }
    }
}
