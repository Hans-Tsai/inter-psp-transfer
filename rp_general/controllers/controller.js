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
const path = require("path");
const fs = require("fs");
const https = require("https");
const axios = require("axios");
const util = require("util");
const verify = util.promisify(jwt.verify);

//#region 工具函式
// 專門產生錯誤事件的物件(=> err object)的錯誤事件處理函數
const handleErrors = (error) => {
    let err = { message: error.message };
    return err;
};

// 產生 JWT token 的函數
const maxValidDuration = 3 * 24 * 60 * 60; // 3 days
const createToken = ({ psp, account, username }) => {
    return jwt.sign({ psp, account, username }, config.server_general.jwt_secret, {
        expiresIn: maxValidDuration,
    });
};

// 使用自發簽名證書
const httpsAgent = new https.Agent({ ca: fs.readFileSync(path.join(__dirname, '../openssl.crt')) });
const axiosInstance = axios.create({ httpsAgent });

//#endregion

const psp_general_get = async (req, res) => {
    const userInfo = await verify(req.query.userInfo, config.server_general.jwt_secret);

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
    const userInfo = await verify(req.query.userInfo, config.server_general.jwt_secret);

    res.render("register", { userInfo });
};

const psp_general_register_options_post = async (req, res) => {
    try {
        let { psp, account, username, user_verification, attestation, attachment, algorithms, discoverable_credential, hints } = req.body;
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
            attestationType: attestation,
            excludeCredentials: userAuthenticators.map((authenticator) => ({
                id: base64url.toBuffer(authenticator.credentialID),
                type: "public-key",
                transports: authenticator.transports,
            })),
            authenticatorSelection: {
                residentKey,
                userVerification: user_verification,
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
            const { credentialPublicKey, credentialID, counter, credentialDeviceType, credentialBackedUp } = registrationInfo;
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
    const userInfo = await verify(req.query.userInfo, config.server_general.jwt_secret);
    
    res.render("authenticate", { userInfo });
};

const psp_general_authenticate_options_post = async (req, res) => {
    try {
        const { psp, account, username, userVerification } = req.body;
        const userAuthenticators = await AuthenticatorModel.getUserAuthenticators({ psp, account, username });
        const options = await SimpleWebAuthnServer.generateAuthenticationOptions({
            rpID: config.rp_general.id,
            userVerification,
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

        res.status(200).json({ verified });
    } catch (error) {
        const err = handleErrors(error);
        res.status(400).json(err);
    }
};

const psp_general_sca_inter_psp_transfer_get = async (req, res) => {
    try {
        const userInfo = await verify(req.query.userInfo, config.server_general.jwt_secret);
        const trxDetails = await verify(req.query.trxDetails, config.server_general.jwt_secret);
        const queryString = { userInfo, trxDetails };
    
        res.render("sca_inter_psp_transfer", { queryString });
    } catch (error) {
        const err = handleErrors(error);
        res.status(400).json(err);
    }
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
            allowCredentials: userAuthenticators.map((authenticator) => ({
                id: base64url.toBuffer(authenticator.credentialID),
                type: "public-key",
                transports: authenticator.transports,
            })),
            challenge: Buffer.from(challengeWithTrxDetails, 'base64').toString('base64url'),
        });
        await redis.db2.setUserCurrentChallenge(redis.client, account, options.challenge);

        res.status(200).json(options);
    } catch (error) {
        const err = handleErrors(error);
        res.status(400).json(err);
    }
};

const psp_general_sca_inter_psp_transfer_authenticate_result_post = async (req, res) => {
    try {
        const { asseResp, psp, account, username } = req.body;
        const expectedChallenge = await redis.db2.getUserCurrentChallenge(redis.client, account);
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

        res.status(200).json({ verified });
    } catch (error) {
        const err = handleErrors(error);
        res.status(400).json(err);
    }
};

const psp_general_sca_inter_psp_transfer_post = async (req, res) => {
    let xaId_psp1, xaId_psp2;
    let xaTransactionStarted = false;
    try {
        const { fromPSP, from, toPSP, to, balance, amount, note } = req.body;
        if (Number(amount) <= 0) throw new Error("轉帳金額必須大於 0");
        if (!Number.isInteger(Number(amount))) throw new Error("轉帳金額必須是整數");
        if (Number(amount) > Number(balance)) throw new Error("餘額不足");
        if (Number(from) === Number(to)) throw new Error("不能轉帳給自己");

        xaId_psp1 = "xa_" + randomXAId();
        xaId_psp2 = "xa_" + randomXAId();
        xaTransactionStarted = true;

        // 2PC prepare
        const psp1_prepared_result = await axiosInstance.post("https://rp1.localhost:3000/psp1/inter_psp_transfer/2pc/prepare",
                                                                { fromPSP, from, toPSP, to, balance, amount, note, xaId: xaId_psp1 });
        const psp2_prepared_result = await axiosInstance.post("https://rp2.localhost:4000/psp2/inter_psp_transfer/2pc/prepare",
                                                                { fromPSP, from, toPSP, to, balance, amount, note, xaId: xaId_psp2 });
        if (!psp1_prepared_result.data.prepared || !psp2_prepared_result.data.prepared) throw new Error("2PC prepare failed");
        // 2PC commit
        const psp1_commit_result = await axiosInstance.post("https://rp1.localhost:3000/psp1/inter_psp_transfer/2pc/commit", { xaId: xaId_psp1 });
        const psp2_commit_result = await axiosInstance.post("https://rp2.localhost:4000/psp2/inter_psp_transfer/2pc/commit", { xaId: xaId_psp2 });
        if (!psp1_commit_result.data.committed || !psp2_commit_result.data.committed) throw new Error("2PC commit failed");

        res.status(200).json({ result: true });
    } catch (error) {
        if (xaTransactionStarted) {
            // 2PC rollback
            await axiosInstance.post("https://rp1.localhost:3000/psp1/inter_psp_transfer/2pc/rollback", { xaId: xaId_psp1 });
            await axiosInstance.post("https://rp2.localhost:4000/psp2/inter_psp_transfer/2pc/rollback", { xaId: xaId_psp2 });
        }
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
