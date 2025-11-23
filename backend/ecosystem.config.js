module.exports = {
    apps: [
        {
            name: "api",
            script: "./server-api.js",
            env: {
                PORT: 4000,
                NODE_ENV: "production",
            },
        },
        {
            name: "ws",
            script: "./server-ws.js",
            env: {
                PORT: 5001,
                NODE_ENV: "production",
            },
        },
    ],
};
