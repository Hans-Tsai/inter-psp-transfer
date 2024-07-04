const express = require('express');
const router = express.Router();
const controller = require('../controllers/controller');
const { requireAuth, checkUser } = require('../middlewares/middleware');
const cors = require('cors');

const corsOptions = {
  origin: 'https://rp-general.localhost:1000',
  methods: 'POST',
  allowedHeaders: ['Content-Type'],
  credentials: true,
  optionsSuccessStatus: 200
};
// 允許瀏覽器的預檢請求 (pre-flight request) (因為預檢請求使用的是 HTTPS 的 `OPTIONS` 方法)
router.options('*', cors(corsOptions));

router.get('/psp1', requireAuth, checkUser, controller.psp1_get);

router.get('/psp1/register', controller.psp1_register_get);
router.post('/psp1/register/options', controller.psp1_register_options_post);
router.post('/psp1/register/result', controller.psp1_register_result_post);
router.get('/psp1/authenticate', controller.psp1_authenticate_get);
router.post('/psp1/authenticate/options', controller.psp1_authenticate_options_post);
router.post('/psp1/authenticate/result', controller.psp1_authenticate_result_post);
router.get('/psp1/logout', controller.psp1_logout_get);

// 更新 `user.isVerified` (不提供使用者自行更新，僅作為後端更新使用)
router.post('/psp1/isVerified', cors(corsOptions), controller.psp1_isVerified_post);

router.get('/psp1/deposit', requireAuth, checkUser, controller.psp1_deposit_get);
router.post('/psp1/deposit', requireAuth, checkUser, controller.psp1_deposit_post);
router.get('/psp1/withdraw', requireAuth, checkUser, controller.psp1_withdraw_get);
router.post('/psp1/withdraw', requireAuth, checkUser, controller.psp1_withdraw_post);
router.get('/psp1/transfer', requireAuth, checkUser, controller.psp1_transfer_get);
router.post('/psp1/transfer', requireAuth, checkUser, controller.psp1_transfer_post);
router.post('/psp1/userInfo_token', requireAuth, checkUser, controller.psp1_userInfo_token_post);
router.get('/psp1/inter_psp_transfer', requireAuth, checkUser, controller.psp1_inter_psp_transfer_get);
router.post('/psp1/user_and_trx_details_token', requireAuth, checkUser, controller.psps1_user_and_trx_details_token_post);
router.post('/psp1/inter_psp_transfer/2pc/prepare', cors(corsOptions), controller.psp1_inter_psp_transfer_2pc_prepare_post);
router.post('/psp1/inter_psp_transfer/2pc/commit', cors(corsOptions), controller.psp1_inter_psp_transfer_2pc_commit_post);
router.post('/psp1/inter_psp_transfer/2pc/rollback', cors(corsOptions), controller.psp1_inter_psp_transfer_2pc_rollback_post);

module.exports = router;





