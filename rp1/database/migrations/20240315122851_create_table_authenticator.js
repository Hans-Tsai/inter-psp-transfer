/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable("authenticator", (table) => {
    // SQL: Encode to base64url then store as `STRING`. Index this column
    table.string("credentialID", 255).notNullable().references("id").inTable("credential").unique();
    table.string("account").notNullable();
    // SQL: Encode to base64url then store as `STRING`.
    table.string("credentialPublicKey");
    table.bigInteger("counter");
    table.string("credentialDeviceType", 32);
    table.boolean("credentialBackedUp");
    // SQL: 為了儲存 string array 可以用 JSON 格式
    table.json("transports"); // e.g. Ex: ['usb', 'ble', 'nfc', 'internal']
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable("authenticator");
};