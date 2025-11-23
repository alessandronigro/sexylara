// utils/log.js
const fs = require("fs");
const path = require("path");

const logToFile = (message) => {
    const logPath = path.join(__dirname, "../logs.txt");
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;

    fs.appendFile(logPath, logEntry, (err) => {
        if (err) console.error("Errore nel logging:", err);
    });
};

module.exports = logToFile;