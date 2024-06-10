const { config } = require("../config");
// 連線到 MySQL 資料庫
const knexConfig = require("../knexfile")[config.env];
const knex = require("knex")(knexConfig);
const crypto = require("crypto");

class UserModel {
    constructor(knex) {
        this.knex = knex;
    }
    
    async getUserInfo({ psp, name, account }) {
        return this.knex("user").select("*").where({ psp, name, account }).first();
    }
}

module.exports = new UserModel(knex);
