const { config } = require("../config");
const knex = require("../database/db");
const crypto = require("crypto");

class UserModel {
    constructor(knex) {
        this.knex = knex;
    }

    async generateAccount() {
        const users = await this.knex("user").select("account");
        let randomAccount = "";
        const length = 5;
        for (let i = 0; i < length; i++) {
            const num = crypto.randomInt(0, 10); // 產生 0 到 9 的隨機整數
            randomAccount += num.toString();
        }
        if (users.some((user) => user.account == randomAccount)) return this.generateAccount();

        return randomAccount;
    }

	async getUserInfo({ account, name }) {
        let query = this.knex("user").select("*");
        if (account || name) {
            query = query.where(function () {
                if (account) this.orWhere({ account });
                if (name) this.orWhere({ name });
            });
        }
        query = query.first();

        return query;
    }

    async updateIsSCA({ account, isSCA }) {
        return this.knex("user").where({ account }).update({ isSCA });
    }

    async updateSCA_verifiedOption({ account, SCA_verifiedOption }) {
        return this.knex("user").where({ account }).update({ SCA_verifiedOption });
    }

    async deposit({ account, amount }) {
        return this.knex("user").where({ account }).increment("balance", amount);
    }

    async withdraw({ account, amount }) {
        return this.knex("user").where({ account }).decrement("balance", amount);
    }
}

module.exports = new UserModel(knex);
