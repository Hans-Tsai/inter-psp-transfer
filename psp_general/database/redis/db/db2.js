// SCA + Inter-PSP transfer (authenticate with transaction details)
async function setUserCurrentChallenge(client, account, currentChallenge) {
    await client.select(2);
    await client.set(account, currentChallenge);
}

async function getUserCurrentChallenge(client, account) {
    await client.select(2);
    return await client.get(account);
}

module.exports = {
    setUserCurrentChallenge,
    getUserCurrentChallenge,
};