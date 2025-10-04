const crypto = require('crypto');
const config = require('../config/config');
const logger = require('../utils/logger');
const { SignatureMismatchError } = require('../utils/errors');
const notificationService = require('./notificationService');
const idempotencyStore = require('../utils/idempotencyStore');

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

const handlePaymentWebhook = async (webhookData, idempotencyKey) => {
  logger.info('Webhook received', { idempotencyKey, payload: webhookData });

  if (idempotencyKey && idempotencyStore.has(idempotencyKey)) {
    logger.warn('Idempotent request already processed', { idempotencyKey });
    return { status: 'Already processed' };
  }

  logger.info('Webhook validated', { idempotencyKey });

  if (webhookData.STATUS === 'TXN_SUCCESS') {
    await updatePaymentStatus(webhookData.ORDERID, 'SUCCESS');
    // Assuming we have customer's phone number in the webhook payload
    await notificationService.sendSMSNotification(
      webhookData.MSISDN,
      `Your payment of ${webhookData.TXNAMOUNT} was successful.`
    );
    logger.info('Payment successful, status updated and notification sent.', { idempotencyKey, orderId: webhookData.ORDERID });
  } else {
    await updatePaymentStatus(webhookData.ORDERID, 'FAILED');
    logger.info('Payment failed, status updated.', { idempotencyKey, orderId: webhookData.ORDERID });
  }
  
  if (idempotencyKey) {
    idempotencyStore.add(idempotencyKey);
  }

  logger.info('Webhook applied', { idempotencyKey });

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

const paymentService = {
  createPayment,
  verifyPaytmSignature,
  handlePaymentWebhook,
  updatePaymentStatus,
  getPaymentById,
};

module.exports = {
  createPayment,
  verifyPaytmSignature,
  handlePaymentWebhook,
  updatePaymentStatus,
  getPaymentById,
};
