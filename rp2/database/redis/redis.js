const redis = require("redis");
const { config } = require("../../config");
const db5 = require('./db/db5');
const db6 = require('./db/db6');

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
    db5,
    db6,
    client,
    closeConnection,
};
