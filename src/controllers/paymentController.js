const paymentService = require('../services/paymentService');
const { SignatureMismatchError } = require('../utils/errors');
const logger = require('../utils/logger');

const createPayment = async (req, res) => {
  try {
    const payment = await paymentService.createPayment(req.body);
    res.status(201).send(payment);
  } catch (error) {
    res.status(500).send({ error: 'Failed to create payment' });
  }
};

const handleWebhook = async (req, res) => {
  const signature = req.headers['x-paytm-signature'];
  const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotencyKey;

  logger.info('Processing webhook', { idempotencyKey });

  try {
    const isValid = await paymentService.verifyPaytmSignature(req.body, signature);
    if (isValid) {
      await paymentService.handlePaymentWebhook(req.body, idempotencyKey);
      res.status(200).send({ status: 'OK' });
    }
  } catch (error) {
    if (error instanceof SignatureMismatchError) {
      return res.status(error.statusCode).send({ error: error.message });
    }
    res.status(500).send({ error: 'Webhook processing failed' });
  }
};

const getPayment = async (req, res) => {
    try {
        const payment = await paymentService.getPaymentById(req.params.id);
        if (payment) {
            res.status(200).send(payment);
        } else {
            res.status(404).send({ error: 'Payment not found' });
        }
    } catch (error) {
        res.status(500).send({ error: 'Failed to get payment' });
    }
}

module.exports = {
  createPayment,
  handleWebhook,
  getPayment,
};
