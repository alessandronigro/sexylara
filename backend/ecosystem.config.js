require('dotenv').config({ path: __dirname + '/.env' });

module.exports = {
    apps: [
        {
            name: "api",
            script: "./server-api.js",
            env: {
                PORT: 4000,
                NODE_ENV: "production",
                REPLICATE_LLM_MODEL: "meta/meta-llama-3-8b-instruct:5a6809ca6288247d06daf6365557e5e429063f32a21146b2a807c682652136b8",
                PM2_LOG_DATE_FORMAT: "YYYY-MM-DD HH:mm:ss",
                ADDRESS_VENICE: process.env.ADDRESS_VENICE,
                API_VENICE: process.env.API_VENICE,
                MODEL_VENICE: process.env.MODEL_VENICE,
                REPLICATE_API_TOKEN: process.env.REPLICATE_API_TOKEN,
                SUPABASE_URL: process.env.SUPABASE_URL,
                SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
                SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
            },
        },
        {
            name: "ws",
            script: "./server-ws.js",
            env: {
                PORT: 5001,
                NODE_ENV: "production",
                REPLICATE_LLM_MODEL: "meta/meta-llama-3-8b-instruct:5a6809ca6288247d06daf6365557e5e429063f32a21146b2a807c682652136b8",
                PM2_LOG_DATE_FORMAT: "YYYY-MM-DD HH:mm:ss",
                ADDRESS_VENICE: process.env.ADDRESS_VENICE,
                API_VENICE: process.env.API_VENICE,
                MODEL_VENICE: process.env.MODEL_VENICE,
                REPLICATE_API_TOKEN: process.env.REPLICATE_API_TOKEN,
                SUPABASE_URL: process.env.SUPABASE_URL,
                SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
                SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
            },
        },
    ],
};
