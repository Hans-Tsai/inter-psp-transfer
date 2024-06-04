exports.up = function(knex) {
  return knex.schema.createTable('user', function(table) {
    table.string('psp').notNullable().references('name').inTable('psp');
    table.string('name').notNullable();
    table.string('account').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // 設定複合主鍵
    table.primary(['psp', 'name', 'account']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('user');
};