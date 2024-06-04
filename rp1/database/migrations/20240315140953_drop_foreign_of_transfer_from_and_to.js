/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.table("transfer", function (table) {
        table.dropForeign("from");
        table.dropForeign("to");
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
