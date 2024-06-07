const util = require("util");
const fs = require("fs");
const https = require("https");
const { config } = require("./config");
const router = require("./routers/router");
const cookieParser = require("cookie-parser");
const express = require("express");
const cors = require("cors");

const app = express();
const knex = require("./database/db");
const redis = require("./database/redis/redis");

let server;
const corsOptions = {
    origin: ["https://rp1.localhost:3000", "https://rp2.localhost:4000"], // 只允許來自這些 origin 的請求
    methods: ["GET", "POST"], // 只允許使用這些 HTTPS 方法
    credentials: true, // 允許跨源請求攜帶 cookie
};
// 允許瀏覽器的預檢請求 (pre-flight request) (因為預檢請求使用的是 HTTPS 的 `OPTIONS` 方法)
app.options('*', cors(corsOptions));
// 指定 view engine 為 `ejs` 模板引擎
app.set("view engine", "ejs");

/** 中介函數 (middleware) */
// 為所有路由設置 CORS 政策
app.use(cors(corsOptions));
// 設定 express app 的靜態資料夾為 `./public/`
app.use(express.static("public"));
// 將 API request 夾帶的 JSON 資料"解析"成 Javascript 的物件 (object) 形式，並將其儲存到 `req.body` 屬性中
app.use(express.json());
// 將 API request 夾帶的 `cookie` 中的 `cookie header` 資料"解析"成 Javascript 的物件 (object) 形式，並將其儲存到 `req.cookies` 的屬性中
app.use(cookieParser());

// 設定路由器
app.use(router);

function startServer() {
    server = https
        .createServer(
            {
                key: fs.readFileSync("mydomain.key"),
                cert: fs.readFileSync("mydomain.crt"),
            },
            app
        )
        .listen(config.server_general.port, () => {
            console.info(`🚀 Server ready at ${config.server_general.origin}/psp_general`);
        });
}

async function gracefulShutdown() {
    try {
        await redis.closeConnection();
        console.log("");
        console.info(util.inspect("Redis client is disconnected.", { colors: true }));

        await knex.destroy();
        console.info(util.inspect("Knex database connection is disconnected.", { colors: true }));

        server.close(() => {
            console.info(util.inspect("The application server is gracefully terminated.", { colors: true }));
            process.exit(0); // Success
        });
    } catch (error) {
        console.error("Error during shutdown:", error.message);
        process.exit(1); // Error
    }
}

// 處理終止信號
process.on("SIGINT", () => {
    gracefulShutdown();
}); // e.g. Ctrl+C

process.on("SIGTERM", () => {
    gracefulShutdown();
}); // e.g. 由 kill 命令發出

startServer();
