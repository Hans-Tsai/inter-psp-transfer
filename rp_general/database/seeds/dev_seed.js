const knex = require("../db");

module.exports.seed = async function (knex) {
    // 刪除資料表的所有內容
    await knex("authenticator").del();
    await knex("credential").del();
    await knex("user").del();
    await knex("psp").del();
    
    // 插入預設資料 (不包含 psp_general)
    await knex("psp").insert([{ name: "psp1" }, { name: "psp2" } ]);
};
