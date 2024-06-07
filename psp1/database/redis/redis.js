const redis = require("redis");
const { config } = require("../../config");
const db3 = require('./db/db3');
const db4 = require('./db/db4');

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
    db3,
    db4,
    client,
    closeConnection,
};
