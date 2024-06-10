const { config } = require('../config');
// 連線到 MySQL 資料庫
const knexConfig = require("../knexfile")[config.env];
const knex = require("knex")(knexConfig);
const util = require("util");

// 初始化資料庫
const databaseName = config.db.name;
knex.raw(`CREATE DATABASE IF NOT EXISTS ??`, [databaseName])
    .then(() => {
        // console.info(`Database ${databaseName} is created`);
    })
    .then(() => {
        return knex.migrate.latest();
        // console.info(util.inspect(`Database: ${databaseName} is migrated to latest version`, { colors: true }));
    })
    .catch((error) => {
        console.error("Error creating database:", error);
    });

module.exports = knex;