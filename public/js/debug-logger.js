// Reusable Debug Utility - Can be used across different JavaScript projects
// Extracted from tutorial.js debugging functions

/**
 * DebugLogger - A configurable debug logging utility
 * Supports rate limiting, deduplication, and conditional logging
 */
class DebugLogger {
    constructor(options = {}) {
        this.options = {
            debugFlag: 'debugMode', // Property name on gameState object
            gameState: null,        // Game state object reference
            verboseEnabled: false,  // Force verbose logging
            rateLimitMs: 1000,      // Minimum time between logs
            dedupeWindowMs: 3000,   // Window for deduplicating identical messages
            storageKey: 'DEBUG_LOGS', // localStorage key for persistent debug setting
            ...options
        };

        // Initialize throttling state
        this._initThrottleState();
    }

    _initThrottleState() {
        if (typeof window !== 'undefined') {
            if (typeof window.__dlogLastTs === 'undefined') window.__dlogLastTs = 0;
            if (typeof window.__dlogSuppressedCount === 'undefined') window.__dlogSuppressedCount = 0;
            if (typeof window.__dlogRateLimitMs === 'undefined') window.__dlogRateLimitMs = this.options.rateLimitMs;
            if (typeof window.__dlogLastMsg === 'undefined') window.__dlogLastMsg = null;
            if (typeof window.__dlogLastMsgTs === 'undefined') window.__dlogLastMsgTs = 0;
        }
    }

    /**
     * Main debug logging function
     * @param {...any} args - Arguments to log
     */
    log(...args) {
        try {
            // Check if explicit verbose flag is set
            if (this.options.verboseEnabled ||
                (typeof window !== 'undefined' && window.__VERBOSE_LOGGING_ENABLED)) {
                console.log(...args);
                return;
            }

            // Check game state debug mode
            const gameState = this.options.gameState;
            const hasGameState = gameState && typeof gameState === 'object';
            const debugMode = hasGameState ? gameState[this.options.debugFlag] : false;

            // Check persisted debug setting
            const persisted = (typeof localStorage !== 'undefined' &&
                             localStorage.getItem &&
                             localStorage.getItem(this.options.storageKey) === '1');

            // Only print if debug mode is active or persisted flag is set
            if (debugMode || persisted) {
                this._logWithThrottling(args);
            }
        } catch (e) {
            // Defensive - ignore errors
        }
    }

    _logWithThrottling(args) {
        const now = Date.now();

        // Build message key for deduplication
        let msgKey = '';
        try {
            msgKey = args.length === 1 ?
                (typeof args[0] === 'string' ? args[0] : JSON.stringify(args[0])) :
                JSON.stringify(args);
        } catch (e) {
            try {
                msgKey = args.map(a => String(a)).join(' ');
            } catch (e2) {
                msgKey = String(args);
            }
        }

        // Deduplicate identical messages within window
        if (msgKey && window.__dlogLastMsg === msgKey &&
            (now - window.__dlogLastMsgTs) < this.options.dedupeWindowMs) {
            window.__dlogSuppressedCount = (window.__dlogSuppressedCount || 0) + 1;
            return;
        }

        // Apply rate limiting
        if (now - window.__dlogLastTs < window.__dlogRateLimitMs) {
            window.__dlogSuppressedCount = (window.__dlogSuppressedCount || 0) + 1;
            window.__dlogLastMsg = msgKey;
            window.__dlogLastMsgTs = now;
            return;
        }

        // Flush suppressed count and log
        if (window.__dlogSuppressedCount > 0) {
            console.log(`(suppressed ${window.__dlogSuppressedCount} messages)`);
            window.__dlogSuppressedCount = 0;
        }

        console.log(...args);
        window.__dlogLastTs = now;
        window.__dlogLastMsg = msgKey;
        window.__dlogLastMsgTs = now;
    }

    /**
     * Log a message at most once per interval
     * @param {string} key - Unique key for this log message
     * @param {number} intervalMs - Minimum interval between logs
     * @param {...any} args - Arguments to log
     */
    logOncePer(key, intervalMs, ...args) {
        try {
            const now = Date.now();
            if (!window.__dlogThrottleMap) window.__dlogThrottleMap = new Map();
            const last = window.__dlogThrottleMap.get(key) || 0;

            if (now - last >= intervalMs) {
                window.__dlogThrottleMap.set(key, now);

                // Check same conditions as regular log
                if (this.options.verboseEnabled ||
                    (typeof window !== 'undefined' && window.__VERBOSE_LOGGING_ENABLED)) {
                    console.log(...args);
                    return;
                }

                const gameState = this.options.gameState;
                const hasGameState = gameState && typeof gameState === 'object';
                const debugMode = hasGameState ? gameState[this.options.debugFlag] : false;
                const persisted = (typeof localStorage !== 'undefined' &&
                                 localStorage.getItem &&
                                 localStorage.getItem(this.options.storageKey) === '1');

                if (hasGameState && debugMode) {
                    console.log(...args);
                } else if (!hasGameState && persisted) {
                    console.log(...args);
                }
            }
        } catch (e) {
            // Ignore
        }
    }

    /**
     * Log only when message content changes
     * @param {string} key - Unique key for tracking changes
     * @param {...any} args - Arguments to log
     */
    logOnChange(key, ...args) {
        try {
            const now = Date.now();
            if (!window.__dlogOnChangeMap) window.__dlogOnChangeMap = new Map();

            let payload;
            try {
                payload = args.length === 1 ? args[0] : JSON.stringify(args);
            } catch (e) {
                payload = args.join(' ');
            }

            const prev = window.__dlogOnChangeMap.get(key);
            if (prev && prev.payload === payload) return; // Unchanged

            window.__dlogOnChangeMap.set(key, { payload, ts: now });
            this.log(...args);
        } catch (e) {
            // Ignore
        }
    }

    /**
     * Set persistent debug logging
     * @param {boolean} enabled - Whether to enable persistent debug logging
     */
    setPersistentDebug(enabled) {
        try {
            if (enabled) {
                localStorage.setItem(this.options.storageKey, '1');
            } else {
                localStorage.removeItem(this.options.storageKey);
            }
            console.log('Persistent DEBUG_LOGS set to', !!enabled);
        } catch (e) {
            console.warn('Unable to set DEBUG_LOGS in localStorage', e);
        }
    }

    /**
     * Enable verbose logging (bypasses all throttling)
     * @param {boolean} enabled - Whether to enable verbose logging
     */
    setVerboseLogging(enabled) {
        this.options.verboseEnabled = !!enabled;
        if (typeof window !== 'undefined') {
            window.__VERBOSE_LOGGING_ENABLED = !!enabled;
        }
        console.log('Verbose logging enabled:', !!enabled);
    }

    /**
     * Update the game state reference
     * @param {object} gameState - New game state object
     */
    setGameState(gameState) {
        this.options.gameState = gameState;
    }

    /**
     * Configure the debug flag property name
     * @param {string} flagName - Property name to check on gameState
     */
    setDebugFlag(flagName) {
        this.options.debugFlag = flagName;
    }

    /**
     * Toggle debug mode and optionally trigger collision debug
     * @param {object} collisionDebugManager - Optional collision debug manager with toggleCollisionDebug() method
     * @param {string} source - Optional source identifier for logging
     * @returns {boolean} New debug mode state
     */
    toggleDebugMode(collisionDebugManager = null, source = 'unknown') {
        const gameState = this.options.gameState;
        if (!gameState) {
            console.warn('Cannot toggle debug mode - no game state reference');
            return false;
        }

        // Toggle the debug flag
        gameState[this.options.debugFlag] = !gameState[this.options.debugFlag];
        const newState = gameState[this.options.debugFlag];
        
        console.log(`[${source}] Debug mode:`, newState ? 'ON' : 'OFF');

        // If collision debug manager provided, toggle it too
        if (collisionDebugManager && typeof collisionDebugManager.toggleCollisionDebug === 'function') {
            collisionDebugManager.toggleCollisionDebug();
            
            // Clear collision graphics when turning off
            if (!newState && typeof collisionDebugManager.clearCollisionGraphics === 'function') {
                collisionDebugManager.clearCollisionGraphics();
            }
        }

        return newState;
    }
}

// Global debug logger instance for backward compatibility
let globalDebugLogger = null;

/**
 * Initialize global debug logger for a specific game state
 * @param {object} gameState - Game state object
 * @param {object} options - Additional options
 * @returns {DebugLogger} The debug logger instance
 */
function initDebugLogger(gameState, options = {}) {
    globalDebugLogger = new DebugLogger({
        gameState,
        ...options
    });
    return globalDebugLogger;
}

/**
 * Get the global debug logger instance
 * @returns {DebugLogger|null} The global debug logger or null if not initialized
 */
function getDebugLogger() {
    return globalDebugLogger;
}

// Backward compatibility functions that delegate to global logger
function dlog(...args) {
    if (globalDebugLogger) {
        globalDebugLogger.log(...args);
    } else {
        // Fallback to console.log if no logger initialized
        console.log(...args);
    }
}

function dlogOncePer(key, intervalMs, ...args) {
    if (globalDebugLogger) {
        globalDebugLogger.logOncePer(key, intervalMs, ...args);
    } else {
        console.log(...args);
    }
}

function dlogOnChange(key, ...args) {
    if (globalDebugLogger) {
        globalDebugLogger.logOnChange(key, ...args);
    } else {
        console.log(...args);
    }
}

/**
 * Toggle debug mode (for use in TAB key handlers)
 * @param {object} collisionDebugManager - Optional collision debug manager
 * @param {string} source - Optional source identifier
 * @returns {boolean} New debug mode state
 */
function toggleDebugMode(collisionDebugManager = null, source = 'TAB-key') {
    if (globalDebugLogger) {
        return globalDebugLogger.toggleDebugMode(collisionDebugManager, source);
    } else {
        console.warn('Debug logger not initialized - cannot toggle debug mode');
        return false;
    }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    // CommonJS
    module.exports = { DebugLogger, initDebugLogger, getDebugLogger, dlog, dlogOncePer, dlogOnChange, toggleDebugMode };
} else if (typeof define === 'function' && define.amd) {
    // AMD
    define([], function() {
        return { DebugLogger, initDebugLogger, getDebugLogger, dlog, dlogOncePer, dlogOnChange, toggleDebugMode };
    });
} else if (typeof window !== 'undefined') {
    // Browser global
    window.DebugLogger = DebugLogger;
    window.initDebugLogger = initDebugLogger;
    window.getDebugLogger = getDebugLogger;
    window.dlog = dlog;
    window.dlogOncePer = dlogOncePer;
    window.dlogOnChange = dlogOnChange;
    window.toggleDebugMode = toggleDebugMode;
}
