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
        name: process.env.DB_NAME || "db2",
    },
    // Database: Redis Server
    redis: {
        host: process.env.REDIS_HOST || "127.0.0.1",
        port: process.env.REDIS_PORT || 6379,
        username: process.env.REDIS_USERNAME || "root",
        password: process.env.REDIS_PASSWORD || "root12345",
    },
    psp: "psp2",
    // Backend Server (web server 2)
    server2: {
        protocol: "https",
        domain: process.env.SERVER2_DOMAIN || "rp2.localhost",
        port: process.env.SERVER2_PORT || 4000,
        jwt_secret: process.env.JWT_SECRET || "fido",
    },
    // Relying Party Server (rp2)
    rp2: {
        name: process.env.RP2_NAME || "rp2",
        protocol: "https",
        // RP ID 應該是一個有效的網域名稱 (effective domain)
        id: process.env.RP2_ID || "rp2.localhost",
        port: process.env.RP2_PORT || 4000,
    },
};

config.server2.origin = `${config.server2.protocol}://${config.server2.domain}:${config.server2.port}`;
config.rp2.origin = `${config.rp2.protocol}://${config.rp2.id}:${config.rp2.port}`;

module.exports = { config };
