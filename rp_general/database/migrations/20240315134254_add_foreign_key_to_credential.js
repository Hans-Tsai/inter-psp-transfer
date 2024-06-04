exports.up = function(knex) {
  return knex.schema.table('credential', function(table) {
    table.foreign(['psp', 'username', 'account']).references(['psp', 'name', 'account']).inTable('user').withKeyName('fk_credential_to_user');
  });
};

exports.down = function(knex) {
  return knex.schema.table('credential', function(table) {
    table.dropForeign(['psp', 'username', 'account'], 'fk_credential_to_user');
  });
};