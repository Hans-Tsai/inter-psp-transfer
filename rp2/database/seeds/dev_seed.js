const knex = require("../db");

module.exports.seed = async function (knex) {
    // 刪除資料表的所有內容
    await knex("authenticator").del();
    await knex("credential").del();
    await knex("transfer").del();
    await knex("user").del();
};
