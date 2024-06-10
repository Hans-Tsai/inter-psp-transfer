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

router.get('/psp2', requireAuth, checkUser, controller.psp2_get);

router.get('/psp2/register', controller.psp2_register_get);
router.post('/psp2/register/options', controller.psp2_register_options_post);
router.post('/psp2/register/result', controller.psp2_register_result_post);
router.get('/psp2/authenticate', controller.psp2_authenticate_get);
router.post('/psp2/authenticate/options', controller.psp2_authenticate_options_post);
router.post('/psp2/authenticate/result', controller.psp2_authenticate_result_post);
router.get('/psp2/logout', controller.psp2_logout_get);

// 更新 `user.isVerified` (不提供使用者自行更新，僅作為後端更新使用)
router.post('/psp2/is_sca_verified', cors(corsOptions), controller.psp2_is_sca_verified_post);

router.get('/psp2/deposit', requireAuth, checkUser, controller.psp2_deposit_get);
router.post('/psp2/deposit', requireAuth, checkUser, controller.psp2_deposit_post);
router.get('/psp2/withdraw', requireAuth, checkUser, controller.psp2_withdraw_get);
router.post('/psp2/withdraw', requireAuth, checkUser, controller.psp2_withdraw_post);
router.get('/psp2/transfer', requireAuth, checkUser, controller.psp2_transfer_get);
router.post('/psp2/transfer', requireAuth, checkUser, controller.psp2_transfer_post);
router.get('/psp2/inter_psp_transfer', requireAuth, checkUser, controller.psp2_inter_psp_transfer_get);
router.post('/psp2/inter_psp_transfer/2pc/prepare', cors(corsOptions), controller.psp2_inter_psp_transfer_2pc_prepare_post);
router.post('/psp2/inter_psp_transfer/2pc/commit', cors(corsOptions), controller.psp2_inter_psp_transfer_2pc_commit_post);
router.post('/psp2/inter_psp_transfer/2pc/rollback', cors(corsOptions), controller.psp2_inter_psp_transfer_2pc_rollback_post);

module.exports = router;