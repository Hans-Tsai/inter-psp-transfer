exports.up = function(knex) {
  return knex.schema.createTable('credential', function(table) {
    table.string('id', 255).primary();
    table.string('psp').notNullable();
    table.string('username').notNullable();
    table.string('account').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('credential');
};