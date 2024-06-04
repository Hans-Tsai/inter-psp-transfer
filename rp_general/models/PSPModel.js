const { config } = require("../config");
// 連線到 MySQL 資料庫
const knexConfig = require("../knexfile")[config.env];
const knex = require("knex")(knexConfig);

class PSPModel {
    constructor(knex) {
        this.knex = knex;
    }

    async getPSPList() {
        return this.knex("psp").select("name");
    }
}

module.exports = new PSPModel(knex);
