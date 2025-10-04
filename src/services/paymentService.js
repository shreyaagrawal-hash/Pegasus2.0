const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/config');
const logger = require('../utils/logger');

// In-memory storage for demo purposes (use database in production)
const payments = new Map();

/**
 * Create a new payment
 * @param {Object} paymentData - Payment information
 * @returns {Object} Payment details
 */
const createPayment = async (paymentData) => {
  try {
    const { customerId, amount, currency = 'INR', description, email, mobile } = paymentData;

    // Validate required fields
    if (!customerId || !amount || !email || !mobile) {
      throw new Error('Missing required fields: customerId, amount, email, mobile');
    }

    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    // Generate unique order ID
    const orderId = `ORDER_${uuidv4()}`;
    const timestamp = new Date().toISOString();

    // Create payment object
    const payment = {
      orderId,
      customerId,
      amount,
      currency,
      description: description || 'Payment',
      email,
      mobile,
      status: 'PENDING',
      createdAt: timestamp,
      updatedAt: timestamp,
      paytmOrderId: null,
      transactionId: null,
    };

    // Mock Paytm initiate transaction (in real scenario, call Paytm API)
    const paytmResponse = await mockPaytmInitiateTransaction(payment);
    payment.paytmOrderId = paytmResponse.orderId;
    payment.paytmTxnToken = paytmResponse.txnToken;

    // Store payment
    payments.set(orderId, payment);

    logger.info('Payment created', {
      orderId,
      customerId,
      amount,
      status: payment.status,
    });

    return {
      success: true,
      orderId,
      paytmOrderId: payment.paytmOrderId,
      txnToken: payment.paytmTxnToken,
      amount,
      currency,
      status: payment.status,
    };
  } catch (error) {
    logger.error('Error creating payment', { error: error.message });
    throw error;
  }
};

/**
 * Mock Paytm initiate transaction API call
 * @param {Object} payment - Payment object
 * @returns {Object} Mock Paytm response
 */
const mockPaytmInitiateTransaction = async (payment) => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 100));

  return {
    orderId: `PAYTM_${payment.orderId}`,
    txnToken: `TXN_TOKEN_${crypto.randomBytes(16).toString('hex')}`,
    resultInfo: {
      resultStatus: 'S',
      resultCode: '0000',
      resultMsg: 'Success',
    },
  };
};

/**
 * Verify Paytm signature/checksum
 * @param {Object} params - Payment response parameters
 * @param {String} checksum - Checksum to verify
 * @returns {Boolean} Verification result
 */
const verifyPaytmSignature = (params, checksum) => {
  try {
    // In real implementation, use Paytm's checksum library
    // For mock purposes, we'll do a simple verification
    const merchantKey = config.paytm.merchantKey;
    
    // Sort parameters
    const sortedParams = Object.keys(params)
      .filter(key => key !== 'CHECKSUMHASH')
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {});

    // Create string from parameters
    const paramString = Object.entries(sortedParams)
      .map(([key, value]) => `${key}=${value}`)
      .join('|');

    // Generate checksum using HMAC SHA256
    const generatedChecksum = crypto
      .createHmac('sha256', merchantKey)
      .update(paramString)
      .digest('hex');

    const isValid = generatedChecksum === checksum;

    logger.info('Paytm signature verification', {
      isValid,
      orderId: params.ORDERID,
    });

    return isValid;
  } catch (error) {
    logger.error('Error verifying Paytm signature', { error: error.message });
    return false;
  }
};

/**
 * Handle payment webhook from Paytm
 * @param {Object} webhookData - Webhook payload
 * @returns {Object} Webhook processing result
 */
const handlePaymentWebhook = async (webhookData) => {
  try {
    const { ORDERID, TXNID, STATUS, CHECKSUMHASH, TXNAMOUNT, RESPCODE, RESPMSG } = webhookData;

    logger.info('Processing payment webhook', {
      orderId: ORDERID,
      txnId: TXNID,
      status: STATUS,
    });

    // Verify signature
    const isValidSignature = verifyPaytmSignature(webhookData, CHECKSUMHASH);
    
    if (!isValidSignature) {
      logger.error('Invalid webhook signature', { orderId: ORDERID });
      throw new Error('Invalid signature');
    }

    // Update payment status
    const updateResult = await updatePaymentStatus(ORDERID, {
      status: STATUS === 'TXN_SUCCESS' ? 'SUCCESS' : 'FAILED',
      transactionId: TXNID,
      amount: TXNAMOUNT,
      responseCode: RESPCODE,
      responseMessage: RESPMSG,
    });

    return {
      success: true,
      orderId: ORDERID,
      status: updateResult.status,
      message: 'Webhook processed successfully',
    };
  } catch (error) {
    logger.error('Error handling payment webhook', { error: error.message });
    throw error;
  }
};

/**
 * Update payment status
 * @param {String} orderId - Order ID
 * @param {Object} updateData - Update information
 * @returns {Object} Updated payment
 */
const updatePaymentStatus = async (orderId, updateData) => {
  try {
    // Extract order ID if it's a Paytm order ID
    const actualOrderId = orderId.startsWith('PAYTM_') 
      ? orderId.replace('PAYTM_', '') 
      : orderId;

    const payment = payments.get(actualOrderId);

    if (!payment) {
      throw new Error(`Payment not found: ${orderId}`);
    }

    // Update payment fields
    Object.assign(payment, {
      ...updateData,
      updatedAt: new Date().toISOString(),
    });

    payments.set(actualOrderId, payment);

    logger.info('Payment status updated', {
      orderId: actualOrderId,
      status: payment.status,
      transactionId: payment.transactionId,
    });

    return payment;
  } catch (error) {
    logger.error('Error updating payment status', {
      orderId,
      error: error.message,
    });
    throw error;
  }
};

/**
 * Get payment by ID
 * @param {String} orderId - Order ID
 * @returns {Object} Payment details
 */
const getPaymentById = async (orderId) => {
  try {
    const payment = payments.get(orderId);

    if (!payment) {
      logger.warn('Payment not found', { orderId });
      throw new Error(`Payment not found: ${orderId}`);
    }

    logger.info('Payment retrieved', { orderId, status: payment.status });

    return payment;
  } catch (error) {
    logger.error('Error getting payment', {
      orderId,
      error: error.message,
    });
    throw error;
  }
};

/**
 * Get all payments (for testing purposes)
 * @returns {Array} All payments
 */
const getAllPayments = () => {
  return Array.from(payments.values());
};

/**
 * Clear all payments (for testing purposes)
 */
const clearAllPayments = () => {
  payments.clear();
};

module.exports = {
  createPayment,
  verifyPaytmSignature,
  handlePaymentWebhook,
  updatePaymentStatus,
  getPaymentById,
  getAllPayments,
  clearAllPayments,
};

