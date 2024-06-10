const { config } = require("../config");
const knex = require("../database/db");

class TransferModel {
    constructor(knex) {
        this.knex = knex;
    }

    // 僅限同機構的用戶之間轉帳
    async transfer({ from, to, amount, note }) {
        let status = false;
        try {
            await knex.transaction(async (trx) => {
                await trx("user").where({ account: from }).decrement("balance", amount);
                await trx("user").where({ account: to }).increment("balance", amount);
                status = true;
                await trx("transfer").insert({
                    fromPSP: config.psp,
                    from,
                    toPSP: config.psp,
                    to,
                    amount,
                    note,
                    status,
                });
            });
        } catch (error) {
            console.erroror(error.message);
            await knex("transfer").insert({
                from,
                to,
                amount,
                note,
                status,
            });
        }
    }

    async addTransferLog({ fromPSP, from, toPSP, to, amount, note, trxId, status }) {
        const data = { fromPSP, from, toPSP, to, amount, note, status };
        let returnId;
        if (trxId) data.trxId = trxId;
        const [id] = await knex("transfer").insert(data);
        if (trxId) {
            returnId = trxId;
        } else {
            returnId = id;
        }

        return returnId;
    }

    async updateTransferLog({ id, trxId, status }) {
        let query;
        if (id) query = knex("transfer").where("id", id);
        if (trxId) query = knex("transfer").where("trxId", trxId);
        if (!query) throw new Error("Either id or trxId must be provided");

        const res = await query.update({ status });
        return res;
    };

    async deleteAllTransferLog() {
        await knex("transfer").del();
    }
}

module.exports = new TransferModel(knex);
