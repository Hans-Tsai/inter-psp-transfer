const redis = require("redis");
const { config } = require("../../config");
const db0 = require('./db/db0');
const db1 = require('./db/db1');
const db2 = require('./db/db2');

const createClientOpt = {
    host: config.redis.host,
    port: config.redis.port,
    // username: config.redis.username,
    // password: config.redis.password,
};
const client = redis.createClient(createClientOpt);
client.connect();

async function closeConnection() {
  try {
      await client.quit();
  } catch (err) {
      console.error('Error closing Redis client:', err.message);
  }
}

module.exports = {
    db0,
    db1,
    db2,
    client,
    closeConnection,
};
