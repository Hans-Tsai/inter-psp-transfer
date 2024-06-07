/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.table("transfer", function (table) {
        table.dropForeign(["from"], "transfer_from_foreign");
        table.dropForeign(["to"], "transfer_to_foreign");
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.table("transfer", function (table) {
        table.foreign("from").references("account").inTable("user");
        table.foreign("to").references("account").inTable("user");
    });
};
