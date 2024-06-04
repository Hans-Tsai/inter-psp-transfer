const { config } = require("../config");
const jwt = require("jsonwebtoken");
const util = require("util");
const verify = util.promisify(jwt.verify);

/** 能被重複使用的中介函數，來驗證客戶端 `cookie` 內的 `JWT token` 存在 & 有效 */
const requireAuth = async (req, res, next) => {
    const keys = Object.keys(req.cookies);
    const jwtKeys = keys.filter(key => key.includes('userJwt'));
    const userJwt = jwtKeys.map(key => req.cookies[key])[0];

    // 驗證客戶端的 `cookie` 中夾帶的 `JWT token` 存在 & 有效
    if (userJwt) {
        try {
            const decodedToken = await verify(userJwt, config.server_general.jwt_secret);
            // console.log(decodedToken);
            // 若客戶端通過驗證 `JWT token` 存在 & 有效，繼續執行接下來的程式(=> `next()`)
            next();
        } catch (error) {
            // 若客戶端的 JWT token 無效，拋出該錯誤訊息，並將瀏覽器畫面導回到相對應的登入畫面
            console.error(error.message);
            res.redirect("/psp_general/authenticate");
        }
    } else {
        // 若客戶端的 `cookie` 中沒有夾帶 `JWT token`，則將瀏覽器畫面導回到相對應的登入畫面
        res.redirect("/psp_general/authenticate");
    }
};

/** 確認當前的使用者的中介函數 */
const checkUser = async (req, res, next) => {
    try {
        console.dir(req.query, { depth: 10 })

        next();
    } catch (error) {
        console.error(error.message);
        res.status(400).json({ error: error.message });   
    }
};


module.exports = {
    requireAuth,
    checkUser,
};
