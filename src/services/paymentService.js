const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/config');
const logger = require('../utils/logger');
const {
  SignatureVerificationError,
  InvalidChecksumError,
  PaymentNotFoundError,
  InvalidPaymentDataError,
} = require('../errors/PaymentErrors');

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
      throw new InvalidPaymentDataError('Missing required fields', [
        'customerId', 'amount', 'email', 'mobile'
      ]);
    }

    if (amount <= 0) {
      throw new InvalidPaymentDataError('Amount must be greater than 0', ['amount']);
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
 * Verify Paytm signature/checksum with enhanced security
 * @param {Object} params - Payment response parameters
 * @param {String} checksum - Checksum to verify
 * @param {Object} securityContext - Additional security context (IP, timestamp, etc.)
 * @returns {Boolean} Verification result
 * @throws {SignatureVerificationError} When signature verification fails
 * @throws {InvalidChecksumError} When checksum format is invalid
 */
const verifyPaytmSignature = (params, checksum, securityContext = {}) => {
  const startTime = Date.now();
  
  // Security context for logging
  const context = {
    orderId: params.ORDERID || 'unknown',
    txnId: params.TXNID || 'unknown',
    amount: params.TXNAMOUNT || 'unknown',
    status: params.STATUS || 'unknown',
    timestamp: new Date().toISOString(),
    ...securityContext,
  };

  try {
    // Validate inputs
    if (!params || typeof params !== 'object') {
      logger.error('Invalid params provided for signature verification', {
        ...context,
        error: 'params must be an object',
      });
      throw new SignatureVerificationError('Invalid parameters provided', context);
    }

    if (!checksum || typeof checksum !== 'string') {
      logger.error('Invalid checksum provided', {
        ...context,
        error: 'checksum must be a non-empty string',
        checksumType: typeof checksum,
      });
      throw new InvalidChecksumError('Checksum must be a non-empty string', context);
    }

    // Validate checksum format (should be hex string)
    if (!/^[a-fA-F0-9]+$/.test(checksum)) {
      logger.error('Checksum format invalid', {
        ...context,
        checksumLength: checksum.length,
        checksumSample: checksum.substring(0, 10) + '...',
      });
      throw new InvalidChecksumError('Checksum must be a valid hex string', context);
    }

    const merchantKey = config.paytm.merchantKey;
    
    if (!merchantKey) {
      logger.error('Merchant key not configured', {
        ...context,
        error: 'PAYTM_MERCHANT_KEY not set',
      });
      throw new SignatureVerificationError('Merchant key not configured', context);
    }

    // Filter and sort parameters (exclude CHECKSUMHASH itself)
    const sortedParams = Object.keys(params)
      .filter(key => key !== 'CHECKSUMHASH' && params[key] !== undefined && params[key] !== null)
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {});

    // Log parameter count for debugging
    logger.debug('Parameters for signature verification', {
      ...context,
      paramCount: Object.keys(sortedParams).length,
      paramKeys: Object.keys(sortedParams).join(', '),
    });

    // Create string from parameters following Paytm specification
    const paramString = Object.entries(sortedParams)
      .map(([key, value]) => `${key}=${value}`)
      .join('|');

    // Generate HMAC-SHA256 checksum
    const generatedChecksum = crypto
      .createHmac('sha256', merchantKey)
      .update(paramString, 'utf8')
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    const isValid = crypto.timingSafeEqual(
      Buffer.from(generatedChecksum, 'hex'),
      Buffer.from(checksum, 'hex')
    );

    const verificationTime = Date.now() - startTime;

    if (isValid) {
      logger.info('Paytm signature verification SUCCESSFUL', {
        ...context,
        verificationTimeMs: verificationTime,
        checksumLength: checksum.length,
        securityLevel: 'high',
      });
      return true;
    } else {
      // Log security event for failed verification
      logger.error('Paytm signature verification FAILED', {
        ...context,
        verificationTimeMs: verificationTime,
        expectedChecksumSample: generatedChecksum.substring(0, 10) + '...',
        providedChecksumSample: checksum.substring(0, 10) + '...',
        securityAlert: 'SIGNATURE_MISMATCH',
        severity: 'HIGH',
      });

      throw new SignatureVerificationError(
        'Signature verification failed - checksum mismatch',
        {
          ...context,
          reason: 'CHECKSUM_MISMATCH',
          verificationTimeMs: verificationTime,
        }
      );
    }
  } catch (error) {
    const verificationTime = Date.now() - startTime;

    // If it's already a typed error, re-throw it
    if (error instanceof SignatureVerificationError || error instanceof InvalidChecksumError) {
      throw error;
    }

    // Log unexpected errors
    logger.error('Unexpected error during signature verification', {
      ...context,
      error: error.message,
      errorType: error.name,
      stack: error.stack,
      verificationTimeMs: verificationTime,
      securityAlert: 'VERIFICATION_ERROR',
      severity: 'CRITICAL',
    });

    throw new SignatureVerificationError(
      `Signature verification error: ${error.message}`,
      {
        ...context,
        originalError: error.message,
        verificationTimeMs: verificationTime,
      }
    );
  }
};

/**
 * Handle payment webhook from Paytm with idempotency
 * @param {Object} webhookData - Webhook payload
 * @param {Object} securityContext - Security context (IP, headers, etc.)
 * @param {String} idempotencyKey - Idempotency key for duplicate prevention
 * @returns {Object} Webhook processing result
 */
const handlePaymentWebhook = async (webhookData, securityContext = {}, idempotencyKey = null) => {
  const startTime = Date.now();
  const { ORDERID, TXNID, STATUS, CHECKSUMHASH, TXNAMOUNT, RESPCODE, RESPMSG } = webhookData;

  const context = {
    orderId: ORDERID || 'unknown',
    txnId: TXNID || 'unknown',
    status: STATUS || 'unknown',
    amount: TXNAMOUNT || 'unknown',
    idempotencyKey,
    ...securityContext,
  };

  try {
    logger.info('Processing payment webhook', {
      ...context,
      timestamp: new Date().toISOString(),
    });

    // Verify signature with security context
    verifyPaytmSignature(webhookData, CHECKSUMHASH, securityContext);

    logger.info('Webhook signature verified successfully', {
      ...context,
      verificationStage: 'completed',
    });

    // Update payment status
    const updateResult = await updatePaymentStatus(ORDERID, {
      status: STATUS === 'TXN_SUCCESS' ? 'SUCCESS' : 'FAILED',
      transactionId: TXNID,
      amount: TXNAMOUNT,
      responseCode: RESPCODE,
      responseMessage: RESPMSG,
    });

    const processingTime = Date.now() - startTime;

    const result = {
      success: true,
      orderId: ORDERID,
      status: updateResult.status,
      message: 'Webhook processed successfully',
      processingTimeMs: processingTime,
    };

    logger.info('Payment webhook processed successfully', {
      ...context,
      finalStatus: updateResult.status,
      processingTimeMs: processingTime,
    });

    return result;
  } catch (error) {
    const processingTime = Date.now() - startTime;

    logger.error('Error handling payment webhook', {
      ...context,
      error: error.message,
      errorType: error.name,
      errorCode: error.errorCode || 'UNKNOWN',
      processingTimeMs: processingTime,
      securityAlert: error instanceof SignatureVerificationError ? 'SIGNATURE_FAILED' : 'PROCESSING_ERROR',
      severity: error instanceof SignatureVerificationError ? 'CRITICAL' : 'HIGH',
    });

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
      throw new PaymentNotFoundError(orderId);
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
      throw new PaymentNotFoundError(orderId);
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

