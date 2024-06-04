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
        name: process.env.DB_NAME || "server1",
    },
    // Database: Redis Server
    redis: {
        host: process.env.REDIS_HOST || "127.0.0.1",
        port: process.env.REDIS_PORT || 6379,
        username: process.env.REDIS_USERNAME || "root",
        password: process.env.REDIS_PASSWORD || "root12345",
    },
    psp: "psp1",
    // Backend Server (server1)
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
    rabbitmq: {
        host: "amqp://guest:guest@127.0.0.1",
        // RabbitMQ Server 預設會啟動在 5672 port; 也可以在瀏覽器中訪問 http://localhost:15672 來打開 RabbitMQ 的管理界面 (需啟用 rabbitmq_management 插件)
        port: 5672,
        // 預設的帳號、密碼
        username: "guest",
        password: "guest",
        connect: { options: { durable: true } },
        exchange: {
            name: "direct_logs",
            type: "direct",
            options: { durable: true },
        },
        queue: {
            requestQueue: {
                name: "requestQueue1",
                options: { durable: true },
            },
            replyQueue: {
                name: "replyQueue1",
                options: { durable: true, exclusive: true },
            },
        },
        // message: {
        //     creditMessage: { routingKey: "creditMessageRoutingKey" },
        //     debitMessage: { routingKey: "debitMessageRoutingKey" },
        // },
    },
};

config.server1.origin = `${config.server1.protocol}://${config.server1.domain}:${config.server1.port}`;
config.rp1.origin = `${config.rp1.protocol}://${config.rp1.id}:${config.rp1.port}`;

module.exports = { config };
