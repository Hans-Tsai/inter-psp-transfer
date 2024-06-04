exports.up = function(knex) {
  return knex.schema.createTable('psp', function(table) {
    table.string('name').notNullable().unique().index();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('psp');
};