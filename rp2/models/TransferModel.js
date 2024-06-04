const { config } = require("../config");
const knex = require("../database/db");

class TransferModel {
    constructor(knex) {
        this.knex = knex;
    }

    // 僅限同機構的用戶之間轉帳
    async transfer({ from, to, amount, note, balance }) {
        // 因為是同機構的用戶之間轉帳，沒有分散式系統的問題，所以不需要考量 Saga 模式，以及資料最終一致性的問題，所以預設是 `failed`
        let status = "failed";
        try {
            await knex.transaction(async (trx) => {
                await trx("user").where({ account: from }).decrement("balance", amount);
                await trx("user").where({ account: to }).increment("balance", amount);
                status = "successful";
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
            // 處理事務錯誤
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

    async addTransfer({ fromPSP, from, toPSP, to, amount, note, correlationId, producerStatus, consumerStatus }) {
        const [id] = await knex("transfer").insert({
            fromPSP,
            from,
            toPSP,
            to,
            amount,
            note,
            correlationId,
            producerStatus,
            consumerStatus,
        });
        return id;
    }

    async updateStatusByCorrelationId({ correlationId, statusType, status }) {
        // 根據傳入的 id, statusType(producerStatus, consumerStatus), status 更新資料庫中的 status
        await knex("transfer")
            .where({ correlationId })
            .update({ [statusType]: status });
    }

    async getTransferStatusByCorrelationId({ correlationId }) {
        const result = await knex("transfer").select("producerStatus", "consumerStatus").where({ correlationId }).first();
        
        return result;
    }

    async deleteAllTransfer() {
        await knex("transfer").del();
    }

    /**
     * 根據 `correlationId` 查詢 replyQueue 是否有匹配的 `message`
     * @description 若找不到指定的 `message`，表示已處理完成 (channel.ack(message))，為成功的狀態
     * @description 若找到指定的 `message`，表示尚未處理完成 (channel.nack(message))，為失敗的狀態
     * @param {string} correlationId
     * @returns {boolean} 指定的 `message` 是否已被正確地處理
     */
    async getReply({ correlationId }) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                resolve(true);
            }, 5000);

            this.channel.consume(this.replyQueue, (msg) => {
                if (msg.properties.correlationId == correlationId) {
                    clearTimeout(timeout);
                    resolve(false);
                }
            });
        });
    }
}

module.exports = new TransferModel(knex);
