// Load environment variables from the `.env` file.
require("dotenv").config();

// 初始設定
let config = {
    // Current Environment
    env: process.env.NODE_ENV || "development",
    // Database: MySQL Server
    db: {
        host: process.env.DB_HOST || "127.0.0.1",
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "root12345",
        name: process.env.DB_NAME || "psp1",
    },
    // Database: Redis Server
    redis: {
        host: process.env.REDIS_HOST || "127.0.0.1",
        port: process.env.REDIS_PORT || 6379,
        username: process.env.REDIS_USERNAME || "root",
        password: process.env.REDIS_PASSWORD || "root12345",
    },
    psp: "psp1",
    // Backend Server (web server 1)
    server1: {
        protocol: "https",
        domain: process.env.SERVER1_DOMAIN || "rp1.localhost",
        port: process.env.SERVER1_PORT || 3000,
        jwt_secret: process.env.JWT_SECRET || "fido_uaf",
    },
    // Relying Party Server (rp1)
    rp1: {
        name: process.env.RP1_NAME || "rp1",
        protocol: "https",
        // RP ID 應該是一個有效的網域名稱 (effective domain)
        id: process.env.RP1_ID || "rp1.localhost",
        port: process.env.RP1_PORT || 3000,
    },
};

config.server1.origin = `${config.server1.protocol}://${config.server1.domain}:${config.server1.port}`;
config.rp1.origin = `${config.rp1.protocol}://${config.rp1.id}:${config.rp1.port}`;

module.exports = { config };
