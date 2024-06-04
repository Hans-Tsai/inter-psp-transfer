/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable("user", (table) => {
    table.string("name").notNullable().unique();
    // 局部 unique (在 psp1 中，是唯一的即可)
    table.string("account").primary().notNullable().unique();
    table.integer("balance").notNullable().defaultTo(0);
    table.boolean("isSCA").notNullable().defaultTo(false);
    table.enu("SCA_verifiedOption", ["once", "everytime"]).defaultTo("once");
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable("user");
};