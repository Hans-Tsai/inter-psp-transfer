/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable("transfer", (table) => {
    table.increments("id").primary();
    table.string("fromPSP").notNullable();
    table.string("from").notNullable().references("account").inTable("user");
    table.string("toPSP").notNullable();
    table.string("to").notNullable().references("account").inTable("user");
    table.integer("amount").notNullable();
    table.string("note", 30).notNullable().defaultTo("無");
    // RabbitMQ 的雙向溝通 RPC 模式使用
    table.string("correlationId").notNullable();
    table.enu("producerStatus", ["pending", "successful", "failed"]);
    table.enu("consumerStatus", ["pending", "successful", "failed"]);
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable("transfer");
};