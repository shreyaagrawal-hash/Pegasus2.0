const paymentService = require('../services/paymentService');

const createPayment = async (req, res) => {
  try {
    const payment = await paymentService.createPayment(req.body);
    res.status(201).send(payment);
  } catch (error) {
    res.status(500).send({ error: 'Failed to create payment' });
  }
};

const handleWebhook = async (req, res) => {
  try {
    // Assuming signature is in headers
    const signature = req.headers['x-paytm-signature'];
    const isValid = await paymentService.verifyPaytmSignature(req.body, signature);
    if (isValid) {
      await paymentService.handlePaymentWebhook(req.body);
      res.status(200).send({ status: 'OK' });
    } else {
      res.status(400).send({ error: 'Invalid signature' });
    }
  } catch (error) {
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
