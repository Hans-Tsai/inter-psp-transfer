const express = require('express');
const router = express.Router();
const controller = require('../controllers/controller');
const cors = require('cors');

const corsOptions = {
    origin: ['https://rp1.localhost:3000', 'https://rp2.localhost:4000'],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true,
    optionsSuccessStatus: 200
};
// 允許瀏覽器的預檢請求 (pre-flight request) (因為預檢請求使用的是 HTTPS 的 `OPTIONS` 方法)
router.options('*', cors(corsOptions));
// 將 CORS 策略，套用到所有路由上
router.use(cors(corsOptions));

router.get('/psp_general', controller.psp_general_get);
router.get('/psp_general/psp_list', controller.psp_general_psp_list_get);

router.get('/psp_general/register', controller.psp_general_register_get);
router.post('/psp_general/register/options', controller.psp_general_register_options_post);
router.post('/psp_general/register/result', controller.psp_general_register_result_post);
router.get('/psp_general/authenticate', controller.psp_general_authenticate_get);
router.post('/psp_general/authenticate/options', controller.psp_general_authenticate_options_post);
router.post('/psp_general/authenticate/result', controller.psp_general_authenticate_result_post);
router.get('/psp_general/sca_inter_psp_transfer', controller.psp_general_sca_inter_psp_transfer_get);
router.post('/psp_general/sca_inter_psp_transfer/authenticate/options', controller.psp_general_sca_inter_psp_transfer_authenticate_options_post);
router.post('/psp_general/sca_inter_psp_transfer/authenticate/result', controller.psp_general_sca_inter_psp_transfer_authenticate_result_post);
router.post('/psp_general/sca_inter_psp_transfer', controller.psp_general_sca_inter_psp_transfer_post);

module.exports = router;
