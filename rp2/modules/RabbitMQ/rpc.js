const amqp = require("amqplib");
const { randomUUID } = require("crypto");
const { config } = require("../../config");
const util = require("util");
const knex = require("../../database/db");
const TransferModel = require("../../models/TransferModel");

class RPC {
    constructor() {
        this.connection = null;
        this.channel = null;
        this.requestQueue = config.rabbitmq.queue.requestQueue.name; // 發送請求的隊列
        this.replyQueue = config.rabbitmq.queue.replyQueue.name; // 接收回覆的隊列
        this.targetRequestQueue = "requestQueue1";
        this.targetReplyQueue = "replyQueue1";
    }

    async init() {
        this.connection = await amqp.connect(config.rabbitmq.host);
        this.channel = await this.connection.createChannel();
        // console.info(util.inspect("RabbitMQ connection is established.", { colors: true }));

        // await channel.assertQueue(queue, options);
        await this.channel.assertQueue(this.replyQueue, config.rabbitmq.queue.replyQueue.options);
        // 監聽回覆隊列
        this.channel.consume(this.replyQueue, async (msg) => {
            if (!msg) return;
            const content = msg.content.toString();
            // console.log(util.inspect(`Received reply:`, { colors: true }));
            // console.dir(JSON.parse(content), { depth: 10 });
            const correlationId = msg.properties.correlationId;

            // 處理接收到的回覆
            const transferStatus = await TransferModel.getTransferStatusByCorrelationId({ correlationId });
            const { producerStatus, consumerStatus } = transferStatus;
            if (producerStatus == "successful" && consumerStatus == "successful") {
                this.channel.ack(msg);
            } else {
                this.channel.nack(msg);
            }
        });

        // await channel.assertQueue(queue, options);
        // 監聽請求隊列
        await this.channel.assertQueue(this.requestQueue, config.rabbitmq.queue.requestQueue.options);
        this.channel.consume(this.requestQueue, async (msg) => {
            if (!msg) return;
            let content = msg.content.toString();
            let forwardTo;
            const correlationId = msg.properties.correlationId;
            const replyTo = msg.properties.replyTo;
            let { operation, fromPSP, from, toPSP, to, balance, amount, note } = JSON.parse(content);
            // console.info(util.inspect(`Received request:`, { colors: true }));
            // console.dir(JSON.parse(content), { depth: 10 });

            // 處理請求
            let trxResult = false;
            let producerStatus = "pending";
            let consumerStatus = "pending";
            await TransferModel.addTransfer({
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
            switch (operation) {
                case "increase":
                    try {
                        await knex("user").where({ account: to }).increment("balance", amount);
                        trxResult = true;
                        let forwardTo = msg.properties.headers?.forwardTo;
                        if (forwardTo) {
                            producerStatus = "successful";
                            await TransferModel.updateStatusByCorrelationId({
                                correlationId: msg.properties.correlationId,
                                statusType: "producerStatus",
                                status: producerStatus,
                            });
                        } else {
                            consumerStatus = "successful";
                            await TransferModel.updateStatusByCorrelationId({
                                correlationId: msg.properties.correlationId,
                                statusType: "consumerStatus",
                                status: consumerStatus,
                            });
                        }
                        // console.info(`Increase: account ${to}, amount ${amount}`);

                        // 轉送請求
                        content = JSON.stringify({
                            operation: "decrease",
                            fromPSP,
                            from,
                            toPSP,
                            to,
                            balance,
                            amount,
                            note,
                        });
                        if (forwardTo != this.requestQueue) {
                            this.sendRequest({
                                headers: { forwardTo: null },
                                requestQueue: forwardTo,
                                requestMessage: content,
                                options: {
                                    correlationId,
                                    replyTo,
                                },
                            });
                        } else {
                            this.sendReply({
                                replyQueue: replyTo,
                                responseMessage: content,
                                options: {
                                    correlationId,
                                },
                            });
                        }

                        this.channel.ack(msg);
                    } catch (error) {
                        // console.error("Increase error:", error.message);
                        // 補償機制
                        if (trxResult) {
                            // console.info(`Increase compensation: account ${to}, amount ${amount}`);
                            await knex("user").where({ account: to }).decrement("balance", amount);
                            if (forwardTo) {
                                producerStatus = "failed";
                                await TransferModel.updateStatusByCorrelationId({
                                    correlationId: msg.properties.correlationId,
                                    statusType: "producerStatus",
                                    status: producerStatus,
                                });
                            } else {
                                consumerStatus = "failed";
                                await TransferModel.updateStatusByCorrelationId({
                                    correlationId: msg.properties.correlationId,
                                    statusType: "consumerStatus",
                                    status: consumerStatus,
                                });
                            }
                        }
                        this.channel.nack(msg);
                    }
                    break;

                case "decrease":
                    try {
                        await knex("user").where({ account: from }).decrement("balance", amount);
                        trxResult = true;
                        let forwardTo = msg.properties.headers?.forwardTo;
                        if (forwardTo) {
                            producerStatus = "successful";
                            await TransferModel.updateStatusByCorrelationId({
                                correlationId: msg.properties.correlationId,
                                statusType: "producerStatus",
                                status: producerStatus,
                            });
                        } else {
                            consumerStatus = "successful";
                            await TransferModel.updateStatusByCorrelationId({
                                correlationId: msg.properties.correlationId,
                                statusType: "consumerStatus",
                                status: consumerStatus,
                            });
                        }
                        // console.info(`Decrease: account ${from}, amount ${amount}`);

                        // 轉送請求
                        content = JSON.stringify({
                            operation: "increase",
                            fromPSP,
                            from,
                            toPSP,
                            to,
                            balance,
                            amount,
                            note,
                        });
                        if (forwardTo != this.requestQueue) {
                            this.sendRequest({
                                headers: { forwardTo: null },
                                requestQueue: forwardTo,
                                requestMessage: content,
                                options: {
                                    correlationId,
                                    replyTo,
                                },
                            });
                        } else {
                            this.sendReply({
                                replyQueue: replyTo,
                                responseMessage: content,
                                options: { correlationId },
                            });
                        }

                        this.channel.ack(msg);
                    } catch (error) {
                        // console.error("Decrease error:", error.message);
                        // 補償機制
                        if (trxResult) {
                            // console.info(`Decrease compensation: account ${from}, amount ${amount}`);
                            await knex("user").where({ account: from }).increment("balance", amount);
                            if (forwardTo) {
                                producerStatus = "failed";
                                await TransferModel.updateStatusByCorrelationId({
                                    correlationId: msg.properties.correlationId,
                                    statusType: "producerStatus",
                                    status: producerStatus,
                                });
                            } else {
                                consumerStatus = "failed";
                                await TransferModel.updateStatusByCorrelationId({
                                    correlationId: msg.properties.correlationId,
                                    statusType: "consumerStatus",
                                    status: consumerStatus,
                                });
                            }
                        }
                        this.channel.nack(msg);
                    }
                    break;
            }
        });
    }

    sendRequest({ requestQueue, requestMessage, options }) {
        const correlationId = options?.correlationId ? options.correlationId : randomUUID();
        // console.log(`Sending request: ${requestMessage}`);
        // channel.sendToQueue(queue, content, [options])
        this.channel.sendToQueue(requestQueue, Buffer.from(requestMessage), {
            headers: { forwardTo: this.targetRequestQueue },
            correlationId,
            replyTo: this.replyQueue,
        });

        return correlationId;
    }

    sendReply({ replyQueue, responseMessage, options }) {
        // console.log(`Received reply: ${responseMessage}`);
        // channel.sendToQueue(queue, content, [options])
        const correlationId = options?.correlationId ? options.correlationId : randomUUID();
        this.channel.sendToQueue(replyQueue, Buffer.from(responseMessage), { correlationId });
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
            }, 3000);

            this.channel.consume(this.replyQueue, (msg) => {
                if (msg.properties.correlationId == correlationId) {
                    clearTimeout(timeout);
                    resolve(false);
                }
            });
        });
    }
}

module.exports = RPC;
