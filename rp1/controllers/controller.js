const { config } = require("../config");
const jwt = require("jsonwebtoken");
const base64url = require("base64url");
const knex = require("../database/db");
const redis = require("../database/redis/redis");
const SimpleWebAuthnServer = require("@simplewebauthn/server");
const UserModel = require("../models/UserModel");
const AuthenticatorModel = require("../models/AuthenticatorModel");
const TransferModel = require("../models/TransferModel");
const qs = require("querystring");
const RPC = require("../modules/RabbitMQ/rpc");

// let rpc;
// (async () => {
//     rpc = new RPC();
//     await rpc.init();
//     // rpc.sendRequest("Hello World");
// })();

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
const createToken = ({ account, username }) => {
    return jwt.sign({ psp: "psp1", account, username }, config.server1.jwt_secret, {
        expiresIn: maxValidDuration,
    });
};

//#endregion

const psp1_get = (req, res) => {
    res.render("index");
};

const psp1_register_get = async (req, res) => {
    res.render("register");
};

const psp1_register_options_post = async (req, res) => {
    try {
        let { username, user_verification, attestation, attachment, algorithms, discoverable_credential, hints } =
            req.body;
        const account = await UserModel.generateAccount();
        const userAuthenticators = await AuthenticatorModel.getUserAuthenticators({ account });
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
            rpName: config.rp1.name,
            rpID: config.rp1.id,
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
        await redis.db2.setUserCurrentChallenge(redis.client, account, options.challenge);
        options.user.id = base64url.encode(account);

        res.status(200).json(options);
    } catch (error) {
        const err = handleErrors(error);
        res.status(400).json(err);
    }
};

const psp1_register_result_post = async (req, res) => {
    try {
        let { attResp, account, username } = req.body;
        account = base64url.decode(account);
        const expectedChallenge = await redis.db2.getUserCurrentChallenge(redis.client, account);
        let verification;
        verification = await SimpleWebAuthnServer.verifyRegistrationResponse({
            response: attResp,
            expectedChallenge,
            expectedOrigin: config.rp1.origin,
            expectedRPID: config.rp1.id,
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
                    });
                    await trx("credential").insert({
                        id: base64urlCredentialID,
                        account,
                    });
                    await trx("authenticator").insert({
                        credentialID: base64urlCredentialID,
                        account,
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

const psp1_authenticate_get = async (req, res) => {
    res.render("authenticate");
};

const psp1_authenticate_options_post = async (req, res) => {
    try {
        const { username, userVerification } = req.body;
        const userInfo = await UserModel.getUserInfo({ name: username });
        const account = userInfo.account;
        const userAuthenticators = await AuthenticatorModel.getUserAuthenticators({ account });
        const options = await SimpleWebAuthnServer.generateAuthenticationOptions({
            rpID: config.rp1.id,
            userVerification,
            // Require users to use a previously-registered authenticator
            allowCredentials: userAuthenticators.map((authenticator) => ({
                id: base64url.toBuffer(authenticator.credentialID),
                type: "public-key",
                transports: authenticator.transports,
            })),
        });
        await redis.db3.setUserCurrentChallenge(redis.client, account, options.challenge);

        res.status(200).json(options);
    } catch (error) {
        const err = handleErrors(error);
        res.status(400).json(err);
    }
};

const psp1_authenticate_result_post = async (req, res) => {
    try {
        const { asseResp, username } = req.body;
        const userInfo = await UserModel.getUserInfo({ name: username });
        const account = userInfo.account;
        const expectedChallenge = await redis.db3.getUserCurrentChallenge(redis.client, account);
        let authenticator = await AuthenticatorModel.getUserAuthenticator({
            account,
            credentialID: asseResp.id,
        });
        if (!authenticator) throw new Error(`Could not find authenticator ${asseResp.id} for user ${account}`);
        authenticator.credentialID = base64url.toBuffer(authenticator.credentialID);
        authenticator.credentialPublicKey = base64url.toBuffer(authenticator.credentialPublicKey);

        let verification;
        verification = await SimpleWebAuthnServer.verifyAuthenticationResponse({
            response: asseResp,
            expectedChallenge,
            expectedOrigin: config.rp1.origin,
            expectedRPID: config.rp1.id,
            authenticator,
        });
        const { verified } = verification;
        const { authenticationInfo } = verification;
        const { newCounter } = authenticationInfo;
        await AuthenticatorModel.updatedAuthenticatorCounter({ credentialID: asseResp.id, newCounter });
        const userJwt = createToken({ account, username });
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

const psp1_logout_get = async (req, res) => {
    // 將要回傳給客戶端的 response 物件中的 `cookie` 設定為空值
    // res.cookie("userJwt", "", { maxAge: 1 });
    for (let key in req.cookies) {
        if (key.endsWith("_userJwt")) res.cookie(key, "", { maxAge: 1 });
    }

    res.redirect("/psp1");
};

const psp1_is_sca_verified_post = async (req, res) => {
    try {
        const psp = req.body.psp;
        const account = req.body.account;
        const isSCA = req.body.isSCA;
        if (psp == config.psp) {
            await UserModel.updateIsSCA({ account, isSCA });
        } else {
            throw new Error("PSP not match");
        }

        res.sendStatus(200);
    } catch (error) {
        const err = handleErrors(error);
        res.status(400).json(err);
    }
};

const psp1_sca_verified_option_post = async (req, res) => {
    try {
        await UserModel.updateSCA_verifiedOption({
            account: req.body.account,
            SCA_verifiedOption: req.body.SCA_verifiedOption,
        });
        res.sendStatus(200);
    } catch (error) {
        res.sendStatus(400);
    }
};

const psp1_deposit_get = (req, res) => {
    res.render("deposit");
};

const psp1_deposit_post = async (req, res) => {
    const { account, balance, amount } = req.body;
    try {
        if (Number(amount) <= 0) throw new Error("儲值金額必須大於 0");
        if (!Number.isInteger(Number(amount))) throw new Error("儲值金額必須是整數");
        await UserModel.deposit({ account, amount });
        const user = await UserModel.getUserInfo({ account });
        // 儲值前的餘額 ＋ 儲值金額 ＝ 儲值後的餘額
        if (Number(balance) + Number(amount) != user.balance) throw new Error("儲值失敗");

        res.sendStatus(200);
    } catch (error) {
        const err = handleErrors(error);
        res.status(400).json(err);
    }
};

const psp1_withdraw_get = (req, res) => {
    res.render("withdraw");
};

const psp1_withdraw_post = async (req, res) => {
    const { account, balance, amount } = req.body;
    try {
        if (Number(amount) <= 0) throw new Error("提領金額必須大於 0");
        if (!Number.isInteger(Number(amount))) throw new Error("儲值金額必須是整數");
        if (Number(amount) > Number(balance)) throw new Error("餘額不足");
        await UserModel.withdraw({ account, amount });
        const user = await UserModel.getUserInfo({ account });
        // 提領前的餘額 － 提領金額 ＝ 提領後的餘額
        if (Number(balance) - Number(amount) != user.balance) throw new Error("提領失敗");

        res.sendStatus(200);
    } catch (error) {
        const err = handleErrors(error);
        res.status(400).json(err);
    }
};

const psp1_transfer_get = (req, res) => {
    knex.select("account", "name")
        .from("user")
        .orderBy("account", "asc")
        .then((data) => {
            res.render("transfer", { data });
        })
        .catch((err) => {
            const error = handleErrors(err);
            res.status(400).json(error);
        });
};

const psp1_transfer_post = async (req, res) => {
    try {
        const { from, to, amount, note, balance } = req.body;
        if (Number(amount) <= 0) throw new Error("轉帳金額必須大於 0");
        if (!Number.isInteger(Number(amount))) throw new Error("轉帳金額必須是整數");
        if (Number(amount) > Number(balance)) throw new Error("餘額不足");
        if (Number(from) === Number(to)) throw new Error("不能轉帳給自己");
        await TransferModel.transfer({ from, to, amount, note, balance });

        res.sendStatus(200);
    } catch (error) {
        const err = handleErrors(error);
        res.status(400).json(err);
    }
};

const psp1_inter_psp_transfer_get = (req, res) => {
    let params = res.locals.userInfo;
    let queryString = qs.stringify(params);
    const isSCA = params.isSCA;

    if (!isSCA) {
        res.redirect("https://rp-general.localhost:1000/psp_general?" + queryString);
    } else {
        res.render("inter_psp_transfer", { data: { psp: config.psp } });
    }
};

const psp1_inter_psp_transfer_2pc_prepare_post = async (req, res) => {
    try {
        const { fromPSP, from, toPSP, to, balance, amount, note, xaId } = req.body;

        await knex.raw("XA START ?;", [xaId]);
        switch (config.psp) {
            case fromPSP:
                await knex("user").where({ account: from }).decrement("balance", Number(amount));
                break;
            case toPSP:
                await knex("user").where({ account: to }).increment("balance", Number(amount));
                break;
            default:
                throw new Error("PSP not match");
        }
        await knex.raw("XA END ?;", [xaId]);
        await knex.raw("XA PREPARE ?;", [xaId]);

        res.status(200).json({ xaId, prepared: true });
    } catch (error) {
        res.status(400).json({ prepared: false, message: `${config.psp} is not prepared for DB 2PC prepared state: ${error.message}` });
    }
};

const psp1_inter_psp_transfer_2pc_commit_post = async (req, res) => {
    try {
        const { xaId } = req.body;
        await knex.raw("XA COMMIT ?;", [xaId]);
        res.status(200).json({ xaId, committed: true });
    } catch (error) {
        await knex.raw("XA ROLLBACK ?;", [xaId]);
        res.status(400).json({ committed: false, message: `${config.psp} is not committed for DB 2PC committed state: ${error.message}` });
    }
};

const psp1_inter_psp_transfer_2pc_rollback_post = async (req, res) => {
    try {
        const { xaId } = req.body;
        await knex.raw("XA ROLLBACK ?;", [xaId]);
        res.status(200).json({ xaId, rollback: true });
    } catch (error) {
        res.status(400).json({ rollback: false, message: `${config.psp} is not rollback for DB 2PC rollback state: ${error.message}` });
    }
}


module.exports = {
    psp1_get,
    psp1_register_get,
    psp1_register_options_post,
    psp1_register_result_post,
    psp1_authenticate_get,
    psp1_authenticate_options_post,
    psp1_authenticate_result_post,
    psp1_logout_get,
    psp1_is_sca_verified_post,
    psp1_sca_verified_option_post,
    psp1_deposit_get,
    psp1_deposit_post,
    psp1_withdraw_get,
    psp1_withdraw_post,
    psp1_transfer_get,
    psp1_transfer_post,
    psp1_inter_psp_transfer_get,
    psp1_inter_psp_transfer_2pc_prepare_post,
    psp1_inter_psp_transfer_2pc_commit_post,
    psp1_inter_psp_transfer_2pc_rollback_post,
};
