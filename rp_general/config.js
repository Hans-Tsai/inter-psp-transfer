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
        name: process.env.DB_NAME || "server_general",
    },
    // Database: Redis Server
    redis: {
        host: process.env.REDIS_HOST || "127.0.0.1",
        port: process.env.REDIS_PORT || 6379,
        username: process.env.REDIS_USERNAME || "root",
        password: process.env.REDIS_PASSWORD || "root12345",
    },
    psp: "psp_general",
    // Backend Server (server_general)
    server_general: {
        protocol: "https",
        domain: process.env.SERVER_GENERAL_DOMAIN || "rp-general.localhost",
        port: process.env.SERVER_GENERAL_PORT || 1000,
        jwt_secret: process.env.JWT_SECRET || "fido_uaf",
    },
    // Relying Party Server (rp_general)
    rp_general: {
        name: process.env.RP_GENERAL_NAME || "rp-general",
        protocol: "https",
        // RP ID 應該是一個有效的網域名稱 (effective domain)
        id: process.env.RP_GENERAL_ID || "rp-general.localhost",
        port: process.env.RP_GENERAL_PORT || 1000,
    },
    rabbitmq: {
        host: 'amqp://localhost',
        // RabbitMQ Server 預設會啟動在 5672 port; 也可以在瀏覽器中訪問 http://localhost:15672 來打開 RabbitMQ 的管理界面 (需啟用 rabbitmq_management 插件)
        port: 5672,
        // 預設的帳號、密碼
        username: 'guest',
        password: 'guest'
    },
};

config.server_general.origin = `${config.server_general.protocol}://${config.server_general.domain}:${config.server_general.port}`;
config.rp_general.origin = `${config.rp_general.protocol}://${config.rp_general.id}:${config.rp_general.port}`;

module.exports = { config };
