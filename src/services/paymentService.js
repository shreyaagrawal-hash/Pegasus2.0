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
 * Create a new payment with robust error handling and retry logic
 * @param {Object} paymentData - Payment information
 * @param {Object} options - Options (retries, timeout)
 * @returns {Object} Payment details
 */
const createPayment = async (paymentData, options = {}) => {
  const startTime = Date.now();
  const { maxRetries = 3, timeout = 5000 } = options;
  
  const context = {
    customerId: paymentData.customerId || 'unknown',
    amount: paymentData.amount || 'unknown',
    currency: paymentData.currency || 'INR',
  };

  try {
    // Stage 1: VALIDATING input
    logger.info('💳 Payment creation STARTED', {
      stage: 'VALIDATING',
      ...context,
      timestamp: new Date().toISOString(),
    });

    const { customerId, amount, currency = 'INR', description, email, mobile } = paymentData;

    // Comprehensive validation
    const validationErrors = [];
    
    if (!customerId || typeof customerId !== 'string') {
      validationErrors.push('customerId must be a non-empty string');
    }
    
    if (!amount || typeof amount !== 'number') {
      validationErrors.push('amount must be a number');
    } else if (amount <= 0) {
      validationErrors.push('amount must be greater than 0');
    } else if (amount > 1000000) {
      validationErrors.push('amount exceeds maximum limit (1,000,000)');
    }
    
    if (!email || typeof email !== 'string') {
      validationErrors.push('email is required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      validationErrors.push('email format is invalid');
    }
    
    if (!mobile || typeof mobile !== 'string') {
      validationErrors.push('mobile is required');
    } else if (!/^[6-9]\d{9}$/.test(mobile)) {
      validationErrors.push('mobile must be a valid Indian mobile number (10 digits starting with 6-9)');
    }

    if (validationErrors.length > 0) {
      logger.error('❌ Payment validation FAILED', {
        stage: 'VALIDATION_FAILED',
        ...context,
        validationErrors,
      });
      throw new InvalidPaymentDataError(
        `Validation failed: ${validationErrors.join(', ')}`,
        validationErrors
      );
    }

    logger.info('✅ Payment validation PASSED', {
      stage: 'VALIDATED',
      ...context,
    });

    // Stage 2: CREATING payment record
    logger.info('⚙️ Payment record CREATING', {
      stage: 'CREATING',
      ...context,
    });

    const orderId = `ORDER_${uuidv4()}`;
    const timestamp = new Date().toISOString();

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
      retryCount: 0,
      lastError: null,
    };

    logger.info('✅ Payment record CREATED', {
      stage: 'CREATED',
      orderId,
      ...context,
    });

    // Stage 3: INITIATING Paytm transaction with retry logic
    logger.info('🔄 Paytm transaction INITIATING', {
      stage: 'PAYTM_INITIATING',
      orderId,
      maxRetries,
    });

    let paytmResponse;
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.debug(`Paytm API call attempt ${attempt}/${maxRetries}`, {
          orderId,
          attempt,
        });

        paytmResponse = await mockPaytmInitiateTransaction(payment, { timeout });
        
        logger.info('✅ Paytm transaction INITIATED successfully', {
          stage: 'PAYTM_INITIATED',
          orderId,
          paytmOrderId: paytmResponse.orderId,
          attempt,
        });
        
        break; // Success - exit retry loop
        
      } catch (error) {
        lastError = error;
        payment.retryCount = attempt;
        
        logger.warn(`⚠️ Paytm API call attempt ${attempt} FAILED`, {
          orderId,
          attempt,
          maxRetries,
          error: error.message,
          willRetry: attempt < maxRetries,
        });

        if (attempt < maxRetries) {
          // Exponential backoff: 100ms, 200ms, 400ms
          const backoffMs = 100 * Math.pow(2, attempt - 1);
          logger.debug(`Waiting ${backoffMs}ms before retry`, { orderId, backoffMs });
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        } else {
          // All retries exhausted
          logger.error('❌ Paytm transaction FAILED after all retries', {
            stage: 'PAYTM_FAILED',
            orderId,
            totalAttempts: maxRetries,
            finalError: error.message,
          });
          
          payment.status = 'FAILED';
          payment.lastError = error.message;
          payments.set(orderId, payment); // Store failed payment for tracking
          
          throw new Error(`Failed to initiate Paytm transaction after ${maxRetries} attempts: ${error.message}`);
        }
      }
    }

    // Stage 4: FINALIZING payment
    logger.info('⚙️ Payment FINALIZING', {
      stage: 'FINALIZING',
      orderId,
    });

    payment.paytmOrderId = paytmResponse.orderId;
    payment.paytmTxnToken = paytmResponse.txnToken;
    payment.updatedAt = new Date().toISOString();

    // Store payment
    payments.set(orderId, payment);

    const processingTime = Date.now() - startTime;

    logger.info('✅ Payment creation COMPLETED successfully', {
      stage: 'COMPLETED',
      orderId,
      customerId,
      amount,
      currency,
      status: payment.status,
      paytmOrderId: payment.paytmOrderId,
      processingTimeMs: processingTime,
      retryCount: payment.retryCount,
      stages: ['VALIDATED', 'CREATED', 'PAYTM_INITIATED', 'COMPLETED'],
    });

    return {
      success: true,
      orderId,
      paytmOrderId: payment.paytmOrderId,
      txnToken: payment.paytmTxnToken,
      amount,
      currency,
      status: payment.status,
      createdAt: payment.createdAt,
      processingTimeMs: processingTime,
    };
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    logger.error('❌ Payment creation FAILED', {
      stage: 'FAILED',
      ...context,
      error: error.message,
      errorType: error.name,
      errorCode: error.errorCode || 'UNKNOWN',
      processingTimeMs: processingTime,
      stack: error.stack,
    });
    
    throw error;
  }
};

/**
 * Mock Paytm initiate transaction API call with timeout and failure simulation
 * @param {Object} payment - Payment object
 * @param {Object} options - Options (timeout, simulateFailure)
 * @returns {Object} Mock Paytm response
 */
const mockPaytmInitiateTransaction = async (payment, options = {}) => {
  const { timeout = 5000, simulateFailure = false } = options;

  // Simulate random failures for testing retry logic (5% chance)
  if (simulateFailure || (Math.random() < 0.05 && payment.retryCount === 0)) {
    throw new Error('Paytm API temporarily unavailable');
  }

  // Simulate API delay with timeout
  const apiDelay = 50 + Math.random() * 100; // 50-150ms
  
  await Promise.race([
    new Promise(resolve => setTimeout(resolve, apiDelay)),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Paytm API timeout')), timeout)
    ),
  ]);

  // Mock successful response
  return {
    orderId: `PAYTM_${payment.orderId}`,
    txnToken: `TXN_TOKEN_${crypto.randomBytes(16).toString('hex')}`,
    resultInfo: {
      resultStatus: 'S',
      resultCode: '0000',
      resultMsg: 'Success',
    },
    timestamp: new Date().toISOString(),
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
    // Stage 1: RECEIVED
    logger.info('🔔 Webhook RECEIVED', {
      stage: 'RECEIVED',
      ...context,
      timestamp: new Date().toISOString(),
    });

    // Stage 2: VALIDATING
    logger.info('🔒 Webhook VALIDATING signature', {
      stage: 'VALIDATING',
      ...context,
    });

    // Verify signature with security context
    verifyPaytmSignature(webhookData, CHECKSUMHASH, securityContext);

    // Stage 2: VALIDATED
    logger.info('✅ Webhook VALIDATED successfully', {
      stage: 'VALIDATED',
      ...context,
      checksumVerified: true,
    });

    // Stage 3: APPLYING updates
    logger.info('⚙️ Webhook APPLYING payment status update', {
      stage: 'APPLYING',
      ...context,
      previousStatus: 'PENDING',
      newStatus: STATUS === 'TXN_SUCCESS' ? 'SUCCESS' : 'FAILED',
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

    // Stage 4: APPLIED
    logger.info('✅ Webhook APPLIED successfully', {
      stage: 'APPLIED',
      ...context,
      finalStatus: updateResult.status,
      processingTimeMs: processingTime,
      stages: ['RECEIVED', 'VALIDATED', 'APPLIED'],
    });

    const result = {
      success: true,
      orderId: ORDERID,
      transactionId: TXNID,
      status: updateResult.status,
      message: 'Webhook processed successfully',
      processingTimeMs: processingTime,
      stages: {
        received: true,
        validated: true,
        applied: true,
      },
    };

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
 * Get payment by ID with robust error handling and caching
 * @param {String} orderId - Order ID
 * @param {Object} options - Options (includeHistory, validateStatus)
 * @returns {Object} Payment details
 */
const getPaymentById = async (orderId, options = {}) => {
  const startTime = Date.now();
  const { includeHistory = false, validateStatus = false } = options;

  try {
    // Stage 1: VALIDATING input
    logger.debug('🔍 Payment retrieval STARTED', {
      stage: 'VALIDATING',
      orderId,
      includeHistory,
      validateStatus,
    });

    // Validate order ID format
    if (!orderId || typeof orderId !== 'string') {
      logger.error('❌ Invalid order ID provided', {
        orderId,
        type: typeof orderId,
      });
      throw new InvalidPaymentDataError('Order ID must be a non-empty string', ['orderId']);
    }

    if (!orderId.startsWith('ORDER_') && !orderId.startsWith('PAYTM_')) {
      logger.warn('⚠️ Unusual order ID format', {
        orderId,
        expectedFormat: 'ORDER_* or PAYTM_*',
      });
    }

    // Stage 2: RETRIEVING payment
    logger.debug('📂 Payment RETRIEVING from storage', {
      stage: 'RETRIEVING',
      orderId,
    });

    const payment = payments.get(orderId);

    if (!payment) {
      logger.warn('❌ Payment NOT FOUND', {
        stage: 'NOT_FOUND',
        orderId,
        availablePayments: payments.size,
      });
      throw new PaymentNotFoundError(orderId);
    }

    logger.info('✅ Payment FOUND', {
      stage: 'FOUND',
      orderId,
      status: payment.status,
      amount: payment.amount,
      customerId: payment.customerId,
    });

    // Stage 3: VALIDATING payment status (if requested)
    if (validateStatus) {
      logger.debug('🔄 Payment status VALIDATING', {
        stage: 'VALIDATING_STATUS',
        orderId,
        currentStatus: payment.status,
      });

      const validStatuses = ['PENDING', 'SUCCESS', 'FAILED', 'PROCESSING', 'CANCELLED'];
      
      if (!validStatuses.includes(payment.status)) {
        logger.error('❌ Invalid payment status detected', {
          orderId,
          status: payment.status,
          validStatuses,
        });
        throw new Error(`Invalid payment status: ${payment.status}`);
      }

      // Check for stale PENDING payments (>24 hours)
      if (payment.status === 'PENDING') {
        const createdDate = new Date(payment.createdAt);
        const hoursSinceCreation = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceCreation > 24) {
          logger.warn('⚠️ Stale PENDING payment detected', {
            orderId,
            status: payment.status,
            hoursSinceCreation: hoursSinceCreation.toFixed(2),
            createdAt: payment.createdAt,
          });
        }
      }

      logger.info('✅ Payment status VALIDATED', {
        stage: 'STATUS_VALIDATED',
        orderId,
        status: payment.status,
      });
    }

    // Stage 4: PREPARING response
    const processingTime = Date.now() - startTime;

    logger.info('✅ Payment retrieval COMPLETED', {
      stage: 'COMPLETED',
      orderId,
      status: payment.status,
      processingTimeMs: processingTime,
    });

    // Create response object
    const response = { ...payment };

    // Add metadata if requested
    if (includeHistory) {
      response.metadata = {
        retrievedAt: new Date().toISOString(),
        processingTimeMs: processingTime,
        ageHours: ((Date.now() - new Date(payment.createdAt).getTime()) / (1000 * 60 * 60)).toFixed(2),
      };
    }

    return response;
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    logger.error('❌ Payment retrieval FAILED', {
      stage: 'FAILED',
      orderId,
      error: error.message,
      errorType: error.name,
      errorCode: error.errorCode || 'UNKNOWN',
      processingTimeMs: processingTime,
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

