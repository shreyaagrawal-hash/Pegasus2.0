const crypto = require('crypto');
const config = require('../config/config');
const logger = require('../utils/logger');
const { SignatureMismatchError } = require('../utils/errors');
const notificationService = require('./notificationService');
const idempotencyStore = require('../utils/idempotencyStore');

const payments = new Map();

const createPayment = async (paymentDetails) => {
  logger.info('Creating payment', { details: paymentDetails });
  try {
    const paymentId = `PAYMENT_${Date.now()}`;
    const newPayment = {
      paymentId,
      status: 'PENDING',
      ...paymentDetails,
      createdAt: new Date(),
    };
    payments.set(paymentId, newPayment);
    logger.info('Payment created successfully', { paymentId });
    // In a real scenario, you would get a transaction token or redirect URL from Paytm
    return {
      success: true,
      paymentId,
      // Mock transaction token
      token: `TXN_TOKEN_${paymentId}`,
    };
  } catch (error) {
    logger.error('Failed to create payment', { error });
    // In a real app, you might want specific error types
    throw new Error('Payment creation failed');
  }
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
  logger.info('Fetching payment by ID', { paymentId });
  const payment = payments.get(paymentId);
  if (!payment) {
    logger.warn('Payment not found', { paymentId });
    return null;
  }
  logger.info('Payment found', { paymentId });
  return payment;
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
