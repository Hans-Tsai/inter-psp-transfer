exports.up = function(knex) {
  return knex.schema.createTable('authenticator', function(table) {
    table.string('credentialID', 255).notNullable().references('id').inTable('credential').unique();
    table.string('psp').notNullable();
    table.string('username').notNullable();
    table.string('account').notNullable();
    table.string('credentialPublicKey');
    table.bigInteger('counter');
    table.string('credentialDeviceType', 32);
    table.boolean('credentialBackedUp');
    table.json('transports');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('authenticator');
};