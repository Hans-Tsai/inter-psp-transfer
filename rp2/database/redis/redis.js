const redis = require("redis");
const { config } = require("../../config");
const db4 = require('./db/db4');
const db5 = require('./db/db5');

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
    db4,
    db5,
    client,
    closeConnection,
};
