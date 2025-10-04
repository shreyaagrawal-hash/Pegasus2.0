const crypto = require('crypto');
const config = require('../config/config');
const logger = require('../utils/logger');
const { SignatureMismatchError } = require('../utils/errors');

const createPayment = async (paymentDetails) => {
  // Mock implementation
  return {
    success: true,
    paymentId: `PAYMENT_${Date.now()}`,
    ...paymentDetails,
  };
};

const verifyPaytmSignature = async (payload, signature) => {
  const body = JSON.stringify(payload);
  const expectedSignature = crypto
    .createHmac('sha256', config.paytm.merchantKey)
    .update(body)
    .digest('hex');

  if (expectedSignature !== signature) {
    logger.error('Paytm signature mismatch', {
      receivedSignature: signature,
      expectedSignature,
      payload,
    });
    throw new SignatureMismatchError('Invalid Paytm signature');
  }

  return true;
};

const handlePaymentWebhook = async (webhookData) => {
  // Mock implementation
  console.log('Webhook received:', webhookData);
  return { success: true };
};

const updatePaymentStatus = async (paymentId, status) => {
  // Mock implementation
  return {
    success: true,
    paymentId,
    status,
  };
};

const getPaymentById = async (paymentId) => {
  // Mock implementation
  return {
    paymentId,
    amount: 100,
    currency: 'INR',
    status: 'SUCCESS',
  };
};

module.exports = {
  createPayment,
  verifyPaytmSignature,
  handlePaymentWebhook,
  updatePaymentStatus,
  getPaymentById,
};
