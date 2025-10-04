const express = require('express');
const paymentController = require('../controllers/paymentController');

const router = express.Router();

router.post('/', paymentController.createPayment);
router.post('/webhook', paymentController.handleWebhook);
router.get('/:id', paymentController.getPayment);

module.exports = router;
