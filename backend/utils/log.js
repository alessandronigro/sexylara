// utils/log.js
// Logger centralizzato: timestamp, file e override di console.* (conserva console originale)
const fs = require("fs");
const path = require("path");
const util = require("util");

const DEFAULT_LOG_PATH = path.join(__dirname, "../logs.txt");
const LOG_PATH = (() => {
  const customPath = process.env.LOG_FILE_PATH || process.env.LOG_PATH;
  if (!customPath) return DEFAULT_LOG_PATH;
  return path.isAbsolute(customPath)
    ? customPath
    : path.resolve(__dirname, "..", customPath);
})();
const CONSOLE_FILTER = (process.env.CONSOLE_LOG_FILTER || "chat").toLowerCase();
const originalConsole = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

function formatLine(level, args) {
  const ts = new Date().toISOString();
  const msg = util.format.apply(null, args);
  return `[${ts}] [${level}] ${msg}`;
}

function append(line) {
  fs.appendFile(LOG_PATH, `${line}\n`, (err) => {
    if (err) {
      originalConsole.error("[LOGGER] Errore nel logging:", err);
    }
  });
}

function write(level, ...args) {
  const line = formatLine(level, args);
  const low = line.toLowerCase();
  // Filtra cosa va in console: se CONSOLE_LOG_FILTER=chat, mostra solo chat e errori
  const emitToConsole = (() => {
    // silenzia rumore noto (getQueueSize etc.) salvo errori
    if (level !== "ERROR" && (low.includes("getqueuesize") || low.includes("memoryconsolidationengine"))) {
      return false;
    }
    if (level === "ERROR") return true;
    if (CONSOLE_FILTER === "chat") {
      return (
        low.includes("[chat") ||
        low.includes(" chat") ||
        low.includes("messaggio") ||
        low.includes("message")
      );
    }
    return true; // default: tutto
  })();

  if (emitToConsole) {
    if (level === "ERROR") {
      originalConsole.error(line);
    } else if (level === "WARN") {
      originalConsole.warn(line);
    } else {
      originalConsole.log(line);
    }
  }
  // Evita anche nel file i log di getQueueSize se non sono errori
  if (!(level !== "ERROR" && low.includes("getqueuesize"))) {
    append(line);
  }
  return line;
}

const logger = {
  log: (...args) => write("INFO", ...args),
  info: (...args) => write("INFO", ...args),
  warn: (...args) => write("WARN", ...args),
  error: (...args) => write("ERROR", ...args),
  patchConsole: () => {
    if (global.__LOGGER_PATCHED) return;
    console.log = (...args) => write("INFO", ...args);
    console.info = (...args) => write("INFO", ...args);
    console.warn = (...args) => write("WARN", ...args);
    console.error = (...args) => write("ERROR", ...args);
    global.__LOGGER_PATCHED = true;
  },
};

// Funzione compatibile con utilizzi esistenti (default export)
function logToFile(message, ...rest) {
  return logger.log(message, ...rest);
}
logToFile.info = logger.info;
logToFile.warn = logger.warn;
logToFile.error = logger.error;
logToFile.patchConsole = logger.patchConsole;

// Auto-patch console.* salvo disattivazione esplicita
if (process.env.AUTO_PATCH_LOGGER !== "false") {
  logger.patchConsole();
}

module.exports = logToFile;
