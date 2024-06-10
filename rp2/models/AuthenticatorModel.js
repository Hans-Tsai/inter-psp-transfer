const { config } = require("../config");
const knex = require("../database/db");
const base64url = require("base64url");
const { isValidBase64Url } = require("../modules/webauthn/utils");

class AuthenticatorModel {
    constructor(knex) {
        this.knex = knex;
    }

    async saveAuthenticator({
        credentialID,
        institution_code,
        account,
        credentialPublicKey,
        counter,
        credentialDeviceType,
        credentialBackedUp,
        transports,
    }) {
        const base64urlCredentialID = isValidBase64Url(credentialID) ? credentialID : base64url.encode(credentialID);
        const base64urlCredentialPublicKey = isValidBase64Url(credentialPublicKey) ? credentialPublicKey : base64url.encode(credentialPublicKey);
        const JSONTransports = JSON.stringify(transports);
        return this.knex("authenticator").insert({
            credentialID: base64urlCredentialID,
            institution_code,
            account,
            credentialPublicKey: base64urlCredentialPublicKey,
            counter,
            credentialDeviceType,
            credentialBackedUp,
            transports: JSONTransports,
        });
    }

    /**
     * @param {string} account
     * @returns Authenticator[]
     * @description Retrieve any of the user's previously registered authenticators.
     */
    async getUserAuthenticators({ account }) {
        return this.knex("authenticator").where({ account });
    }

    /**
     * @param {number} institution_code
     * @param {string} account
     * @param {string} name (username)
     * @param {string} credentialID
     * @returns authenticator
     * @description Retrieve an authenticator from the DB that should match the `credentialID` in the returned credential.
     */
    async getUserAuthenticator({ account, credentialID }) {
        let query = this.knex("authenticator").where({ account });
        if (credentialID) {
            const base64urlCredentialID = isValidBase64Url(credentialID) ? credentialID : base64url.encode(credentialID);
            query = query.andWhere({ credentialID: base64urlCredentialID });
        }
        query = query.first();

        return query;
    }

    async updatedAuthenticatorCounter({ credentialID, newCounter }) {
        const base64urlCredentialID = isValidBase64Url(credentialID) ? credentialID : base64url.encode(credentialID);
        return this.knex("authenticator").where({ credentialID: base64urlCredentialID }).update({ counter: newCounter });
    }
}

module.exports = new AuthenticatorModel(knex);
