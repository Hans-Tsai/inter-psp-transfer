const crypto = require("crypto");
const base64url = require("base64url");

function randomChallenge() {
    return crypto.randomUUID();
}

function isValidBase64Url(str) {
    try {
        // 嘗試將 str 解碼為 base64url格式
        base64url.decode(str);
        return true;
    } catch (e) {
        return false;
    }
}

module.exports = {
    randomChallenge,
    isValidBase64Url,
};
