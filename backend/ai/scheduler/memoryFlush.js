// =====================================================
// MEMORY FLUSH SCHEDULER
// =====================================================
// Scheduler che esegue flush memoria ogni 5 secondi.

const MemoryConsolidationEngine = require('../learning/MemoryConsolidationEngine');

let flushInterval = null;

/**
 * Start scheduler
 * @param {Number} intervalMs - Intervallo in millisecondi (default: 5000)
 */
function start(intervalMs = 5000) {
    if (flushInterval) {
        console.warn('⚠️ Memory flush scheduler already running');
        return;
    }

    console.log(`🧠 Starting memory flush scheduler (interval: ${intervalMs}ms)`);

    flushInterval = setInterval(async () => {
        const queueSize = MemoryConsolidationEngine.getQueueSize();
        if (queueSize > 0) {
            await MemoryConsolidationEngine.flush();
        }
    }, intervalMs);
}

/**
 * Stop scheduler
 */
function stop() {
    if (flushInterval) {
        clearInterval(flushInterval);
        flushInterval = null;
        console.log('🧠 Memory flush scheduler stopped');
    }
}

/**
 * Get scheduler status
 * @returns {Boolean}
 */
function isRunning() {
    return flushInterval !== null;
}

module.exports = {
    start,
    stop,
    isRunning
};
