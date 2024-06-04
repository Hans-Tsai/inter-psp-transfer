// Authenticate (FIDO)
async function setUserCurrentChallenge(client, account, currentChallenge) {
  await client.select(5);
  await client.set(account, currentChallenge);
}

async function getUserCurrentChallenge(client, account) {
  await client.select(5);
  return await client.get(account);
}

module.exports = {
  setUserCurrentChallenge,
  getUserCurrentChallenge,
};
