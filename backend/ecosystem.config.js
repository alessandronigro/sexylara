require('dotenv').config({ path: __dirname + '/.env' });

module.exports = {
    apps: [
        {
            name: "api",
            script: "./server-api.js",
            env: {
                PORT: 4000,
                NODE_ENV: "production",
                PM2_LOG_DATE_FORMAT: "YYYY-MM-DD HH:mm:ss",
            },
        },
        {
            name: "ws",
            script: "./server-ws.js",
            env: {
                PORT: 5001,
                NODE_ENV: "production",
                PM2_LOG_DATE_FORMAT: "YYYY-MM-DD HH:mm:ss",
            },
        },
    ],
};
