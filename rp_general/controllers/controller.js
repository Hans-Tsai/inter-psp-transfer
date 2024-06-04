const { config } = require("../config");
const jwt = require("jsonwebtoken");
const base64url = require("base64url");
const knex = require("../database/db");
const redis = require("../database/redis/redis");
const SimpleWebAuthnServer = require("@simplewebauthn/server");
const UserModel = require("../models/UserModel");
const PSPModel = require("../models/PSPModel");
const AuthenticatorModel = require("../models/AuthenticatorModel");
const crypto = require('crypto');
const { randomXAId } = require("../modules/webauthn/utils");
const axios = require("axios");

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
//#region 工具函式
// TODO: 建立一個用來專門產生錯誤事件的物件(=> err object)的錯誤事件處理函數
const handleErrors = (error) => {
    let err = { message: error.message };

    // TODO: MySQL - duplicate key err
    // if (error.code === 11000) {
    //   err['account'] = 'that account is already registered';
    //   return err;
    // }

    // TODO: validation err

    return err;
};

/** 建立一個用來產生 JWT token 的函數
 * @returns 回傳一個帶有簽章(signature)的 JWT token
 */
// JWT token 的有效期間長度，`jwt.sign()` 是以秒為單位
const maxValidDuration = 3 * 24 * 60 * 60; // 3 days
const createToken = ({ psp, account, username }) => {
    return jwt.sign({ psp, account, username }, config.server_general.jwt_secret, {
        expiresIn: maxValidDuration,
    });
};

//#endregion

const psp_general_get = async (req, res) => {
    const userInfo = req.query;
    res.render("index", { userInfo });
};

const psp_general_psp_list_get = async (req, res) => {
    try {
        let pspList = await PSPModel.getPSPList();
        pspList = pspList.map((psp) => psp.name);

        res.status(200).json({ pspList });
    } catch (error) {
        const err = handleErrors(error);
        res.status(400).json(err);
    }
};

const psp_general_register_get = async (req, res) => {
    const userInfo = req.query;
    res.render("register", { userInfo });
};

const psp_general_register_options_post = async (req, res) => {
    try {
        let {
            psp,
            account,
            username,
            user_verification,
            attestation,
            attachment,
            algorithms,
            discoverable_credential,
            hints,
        } = req.body;
        const userAuthenticators = await AuthenticatorModel.getUserAuthenticators({ psp, account, username });
        let residentKey = "";
        switch (discoverable_credential) {
            case "discouraged":
                residentKey = "discouraged";
                break;
            case "preferred":
                residentKey = "preferred";
                break;
            case "required":
                residentKey = "required";
                break;
            default:
                residentKey = "preferred";
                break;
        }
        if (hints.length > 0) {
            hints = [hints][0].split(",");
            if (hints[0] === "security-key" || hints[0] === "hybrid") {
                attachment = "cross-platform";
            } else if (hints[0] === "client-device") {
                attachment = "platform";
            }
        } else {
            attachment = undefined;
        }

        const options = await SimpleWebAuthnServer.generateRegistrationOptions({
            rpName: config.rp_general.name,
            rpID: config.rp_general.id,
            userID: account,
            userName: username,
            // Don't prompt users for additional information about the authenticator
            // (Recommended for smoother UX)
            attestationType: attestation,
            // Prevent users from re-registering existing authenticators
            excludeCredentials: userAuthenticators.map((authenticator) => ({
                id: base64url.toBuffer(authenticator.credentialID),
                type: "public-key",
                // Optional
                transports: authenticator.transports,
            })),
            // See "Guiding use of authenticators via authenticatorSelection" below
            authenticatorSelection: {
                // Defaults
                residentKey,
                userVerification: user_verification,
                // Optional
                authenticatorAttachment: attachment,
            },
            supportedAlgorithmIDs: algorithms,
        });
        await redis.db0.setUserCurrentChallenge(redis.client, account, options.challenge);
        options.user.id = base64url.encode(account);

        res.status(200).json(options);
    } catch (error) {
        const err = handleErrors(error);
        res.status(400).json(err);
    }
};

const psp_general_register_result_post = async (req, res) => {
    try {
        let { attResp, psp, account, username } = req.body;
        account = base64url.decode(account);
        const expectedChallenge = await redis.db0.getUserCurrentChallenge(redis.client, account);
        let verification;
        verification = await SimpleWebAuthnServer.verifyRegistrationResponse({
            response: attResp,
            expectedChallenge,
            expectedOrigin: config.rp_general.origin,
            expectedRPID: config.rp_general.id,
        });
        const { verified } = verification;
        if (verified) {
            const { registrationInfo } = verification;
            const { credentialPublicKey, credentialID, counter, credentialDeviceType, credentialBackedUp } =
                registrationInfo;
            const base64urlCredentialID = base64url.encode(credentialID);
            const base64urlCredentialPublicKey = base64url.encode(credentialPublicKey);
            try {
                await knex.transaction(async (trx) => {
                    await trx("user").insert({
                        account,
                        name: username,
                        psp,
                    });
                    await trx("credential").insert({
                        id: base64urlCredentialID,
                        psp,
                        account,
                        username,
                    });
                    await trx("authenticator").insert({
                        credentialID: base64urlCredentialID,
                        psp,
                        account,
                        username,
                        credentialPublicKey: base64urlCredentialPublicKey,
                        counter,
                        credentialDeviceType,
                        credentialBackedUp,
                        transports: JSON.stringify(attResp.response.transports),
                    });
                });
            } catch (transactionError) {
                // 處理事務錯誤
                console.error(transactionError);
            }
        } else {
            throw new Error("Verify registration response failed");
        }

        res.status(200).json({ verified });
    } catch (error) {
        const err = handleErrors(error);
        res.status(400).json(err);
    }
};

const psp_general_authenticate_get = async (req, res) => {
    const userInfo = req.query;
    res.render("authenticate", { userInfo });
};

const psp_general_authenticate_options_post = async (req, res) => {
    try {
        const { psp, account, username, userVerification } = req.body;
        const userAuthenticators = await AuthenticatorModel.getUserAuthenticators({ psp, account, username });
        const options = await SimpleWebAuthnServer.generateAuthenticationOptions({
            rpID: config.rp_general.id,
            userVerification,
            // Require users to use a previously-registered authenticator
            allowCredentials: userAuthenticators.map((authenticator) => ({
                id: base64url.toBuffer(authenticator.credentialID),
                type: "public-key",
                transports: authenticator.transports,
            })),
        });
        await redis.db1.setUserCurrentChallenge(redis.client, account, options.challenge);

        res.status(200).json(options);
    } catch (error) {
        const err = handleErrors(error);
        res.status(400).json(err);
    }
};

const psp_general_authenticate_result_post = async (req, res) => {
    try {
        const { asseResp, psp, account, username } = req.body;
        const expectedChallenge = await redis.db1.getUserCurrentChallenge(redis.client, account);
        let authenticator = await AuthenticatorModel.getUserAuthenticator({
            psp, 
            account,
            username,
            credentialID: asseResp.id,
        });
        if (!authenticator) throw new Error(`Could not find authenticator ${asseResp.id} for user ${account}`);
        authenticator.credentialID = base64url.toBuffer(authenticator.credentialID);
        authenticator.credentialPublicKey = base64url.toBuffer(authenticator.credentialPublicKey);

        let verification;
        verification = await SimpleWebAuthnServer.verifyAuthenticationResponse({
            response: asseResp,
            expectedChallenge,
            expectedOrigin: config.rp_general.origin,
            expectedRPID: config.rp_general.id,
            authenticator,
        });
        const { verified } = verification;
        const { authenticationInfo } = verification;
        const { newCounter } = authenticationInfo;
        await AuthenticatorModel.updatedAuthenticatorCounter({ credentialID: asseResp.id, newCounter });
        const userJwt = createToken({ psp, account, username });
        res.cookie(`${username}_userJwt`, userJwt, {
            httpOnly: true,
            maxAge: maxValidDuration * 1000, // 以毫秒為單位
        });

        res.status(200).json({ verified });
    } catch (error) {
        const err = handleErrors(error);
        res.status(400).json(err);
    }
};

const psp_general_sca_inter_psp_transfer_get = (req, res) => {
    const params = req.query;
    res.render("sca_inter_psp_transfer", { params });
};

const psp_general_sca_inter_psp_transfer_authenticate_options_post = async (req, res) => {
    try {
        const { psp, account, username, userVerification, transaction_details } = req.body;
        const detailsString = JSON.stringify(transaction_details);
        const challengeWithTrxDetails = crypto.createHash('sha256').update(detailsString).digest('base64');

        const userAuthenticators = await AuthenticatorModel.getUserAuthenticators({ psp, account, username });
        const options = await SimpleWebAuthnServer.generateAuthenticationOptions({
            rpID: config.rp_general.id,
            userVerification,
            // Require users to use a previously-registered authenticator
            allowCredentials: userAuthenticators.map((authenticator) => ({
                id: base64url.toBuffer(authenticator.credentialID),
                type: "public-key",
                transports: authenticator.transports,
            })),
            challenge: Buffer.from(challengeWithTrxDetails, 'base64').toString('base64url'),
        });
        await redis.db6.setUserCurrentChallenge(redis.client, account, options.challenge);

        res.status(200).json(options);
    } catch (error) {
        const err = handleErrors(error);
        res.status(400).json(err);
    }
};

const psp_general_sca_inter_psp_transfer_authenticate_result_post = async (req, res) => {
    try {
        const { asseResp, psp, account, username } = req.body;
        const expectedChallenge = await redis.db6.getUserCurrentChallenge(redis.client, account);
        let authenticator = await AuthenticatorModel.getUserAuthenticator({
            psp, 
            account,
            username,
            credentialID: asseResp.id,
        });
        if (!authenticator) throw new Error(`Could not find authenticator ${asseResp.id} for user ${account}`);
        authenticator.credentialID = base64url.toBuffer(authenticator.credentialID);
        authenticator.credentialPublicKey = base64url.toBuffer(authenticator.credentialPublicKey);

        let verification;
        verification = await SimpleWebAuthnServer.verifyAuthenticationResponse({
            response: asseResp,
            expectedChallenge,
            expectedOrigin: config.rp_general.origin,
            expectedRPID: config.rp_general.id,
            authenticator,
        });
        const { verified } = verification;
        const { authenticationInfo } = verification;
        const { newCounter } = authenticationInfo;
        await AuthenticatorModel.updatedAuthenticatorCounter({ credentialID: asseResp.id, newCounter });
        const scaJwt = createToken({ psp, account, username });
        res.cookie(`${username}_scaJwt`, scaJwt, {
            httpOnly: true,
            maxAge: maxValidDuration * 1000, // 以毫秒為單位
        });

        res.status(200).json({ verified });
    } catch (error) {
        const err = handleErrors(error);
        res.status(400).json(err);
    }
};

const psp_general_sca_inter_psp_transfer_post = async (req, res) => {
    let xaId_psp1, xaId_psp2;
    try {
        const { fromPSP, from, toPSP, to, balance, amount, note } = req.body;
        xaId_psp1 = "xa_" + randomXAId();
        xaId_psp2 = "xa_" + randomXAId();
        if (Number(amount) <= 0) throw new Error("轉帳金額必須大於 0");
        if (!Number.isInteger(Number(amount))) throw new Error("轉帳金額必須是整數");
        if (Number(amount) > Number(balance)) throw new Error("餘額不足");
        if (Number(from) === Number(to)) throw new Error("不能轉帳給自己");

        // 2PC prepare
        const psp1_prepared_result = await axios.post("https://rp1.localhost:3000/psp1/inter_psp_transfer/2pc/prepare", { fromPSP, from, toPSP, to, balance, amount, note, xaId: xaId_psp1 });
        const psp2_prepared_result = await axios.post("https://rp2.localhost:4000/psp2/inter_psp_transfer/2pc/prepare", { fromPSP, from, toPSP, to, balance, amount, note, xaId: xaId_psp2 });
        if (!psp1_prepared_result.data.prepared || !psp2_prepared_result.data.prepared) throw new Error("2PC prepare failed");
        // 2PC commit
        const psp1_commit_result = await axios.post("https://rp1.localhost:3000/psp1/inter_psp_transfer/2pc/commit", { xaId: xaId_psp1 });
        const psp2_commit_result = await axios.post("https://rp2.localhost:4000/psp2/inter_psp_transfer/2pc/commit", { xaId: xaId_psp2 });
        if (!psp1_commit_result.data.committed || !psp2_commit_result.data.committed) throw new Error("2PC commit failed");

        res.status(200).json({ result: true });
    } catch (error) {
        // 2PC rollback
        await axios.post("https://rp1.localhost:3000/psp1/inter_psp_transfer/2pc/rollback", { xaId: xaId_psp1 });
        await axios.post("https://rp2.localhost:4000/psp2/inter_psp_transfer/2pc/rollback", { xaId: xaId_psp2 });
        res.status(400).json({ result: false, message: error.message });
    }
};

module.exports = {
    psp_general_get,
    psp_general_psp_list_get,
    psp_general_register_get,
    psp_general_register_options_post,
    psp_general_register_result_post,
    psp_general_authenticate_get,
    psp_general_authenticate_options_post,
    psp_general_authenticate_result_post,
    psp_general_sca_inter_psp_transfer_get,
    psp_general_sca_inter_psp_transfer_authenticate_options_post,
    psp_general_sca_inter_psp_transfer_authenticate_result_post,
    psp_general_sca_inter_psp_transfer_post,
};
