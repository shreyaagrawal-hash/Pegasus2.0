const express = require('express');
const router = express.Router();
const paymentService = require('../services/paymentService');
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');
const { 
  extractIdempotencyKey, 
  checkIdempotencyKey, 
  storeIdempotencyKey 
} = require('../utils/idempotency');
const {
  SignatureVerificationError,
  InvalidChecksumError,
  DuplicateWebhookError,
  PaymentError,
} = require('../errors/PaymentErrors');

/**
 * POST /api/payments/create
 * Create a new payment
 */
router.post('/create', async (req, res) => {
  try {
    const paymentData = req.body;
    const result = await paymentService.createPayment(paymentData);
    
    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Payment creation failed', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/payments/:orderId
 * Get payment by order ID
 */
router.get('/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const payment = await paymentService.getPaymentById(orderId);
    
    res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    logger.error('Get payment failed', { error: error.message });
    res.status(404).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/payments/callback
 * Paytm callback endpoint (similar to webhook with UI redirect)
 */
router.post('/callback', async (req, res) => {
  const callbackData = req.body;
  
  // Extract idempotency key
  const idempotencyKey = extractIdempotencyKey(req, callbackData);
  
  // Build security context
  const securityContext = {
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    timestamp: new Date().toISOString(),
    requestId: req.get('x-request-id') || 'unknown',
  };

  try {
    // Check for duplicate callback
    if (idempotencyKey) {
      const cached = checkIdempotencyKey(idempotencyKey);
      if (cached) {
        logger.info('Duplicate callback detected, returning cached response', {
          idempotencyKey,
          orderId: callbackData.ORDERID,
        });
        
        return res.status(200).json({
          success: true,
          data: cached.data,
          duplicate: true,
        });
      }
    }

    const result = await paymentService.handlePaymentWebhook(
      callbackData, 
      securityContext,
      idempotencyKey
    );
    
    // Store idempotency key
    if (idempotencyKey) {
      storeIdempotencyKey(idempotencyKey, result, 'success');
    }

    // Send SMS notification for payment status
    try {
      const payment = await paymentService.getPaymentById(result.orderId);
      await notificationService.sendPaymentNotification({
        mobile: payment.mobile,
        orderId: payment.orderId,
        amount: payment.amount,
        status: payment.status,
      });
    } catch (smsError) {
      logger.error('Failed to send payment notification', {
        orderId: result.orderId,
        error: smsError.message,
      });
    }
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    let statusCode = 400;
    if (error instanceof SignatureVerificationError || error instanceof InvalidChecksumError) {
      statusCode = 401;
    } else if (error instanceof PaymentError) {
      statusCode = error.statusCode;
    }

    logger.error('Payment callback failed', { 
      error: error.message,
      errorCode: error.errorCode,
      ...securityContext,
    });

    res.status(statusCode).json({
      success: false,
      error: error.message,
      errorCode: error.errorCode || 'CALLBACK_ERROR',
    });
  }
});

/**
 * POST /api/payments/webhook
 * Paytm webhook endpoint with idempotency and enhanced security
 */
router.post('/webhook', async (req, res) => {
  const webhookData = req.body;
  
  // Extract idempotency key
  const idempotencyKey = extractIdempotencyKey(req, webhookData);
  
  // Build security context
  const securityContext = {
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    timestamp: new Date().toISOString(),
    requestId: req.get('x-request-id') || 'unknown',
  };

  try {
    logger.info('Webhook request received', {
      orderId: webhookData.ORDERID,
      txnId: webhookData.TXNID,
      idempotencyKey,
      ...securityContext,
    });

    // Check for duplicate webhook using idempotency key
    if (idempotencyKey) {
      const cached = checkIdempotencyKey(idempotencyKey);
      if (cached) {
        logger.info('Duplicate webhook detected, returning cached response', {
          idempotencyKey,
          orderId: webhookData.ORDERID,
          cachedStatus: cached.status,
        });
        
        return res.status(200).json({
          success: true,
          data: cached.data,
          duplicate: true,
          message: 'Duplicate request - returning cached response',
        });
      }
    }

    // Process webhook with security context
    const result = await paymentService.handlePaymentWebhook(
      webhookData, 
      securityContext, 
      idempotencyKey
    );
    
    // Store idempotency key with result
    if (idempotencyKey) {
      storeIdempotencyKey(idempotencyKey, result, 'success');
    }

    // Send SMS notification for payment status
    try {
      const payment = await paymentService.getPaymentById(result.orderId);
      
      logger.info('📱 Sending SMS notification for payment', {
        orderId: payment.orderId,
        status: payment.status,
        mobile: payment.mobile,
      });

      const smsResult = await notificationService.sendPaymentNotification({
        mobile: payment.mobile,
        orderId: payment.orderId,
        amount: payment.amount,
        status: payment.status,
      });

      logger.info('✅ SMS notification sent successfully', {
        orderId: payment.orderId,
        notificationId: smsResult.notificationId,
        smsId: smsResult.smsId,
      });

    } catch (smsError) {
      logger.error('❌ Failed to send payment notification', {
        orderId: result.orderId,
        error: smsError.message,
        errorType: smsError.name,
      });
      // Don't fail the webhook if SMS fails - payment is already processed
    }
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    // Handle typed errors with appropriate status codes
    let statusCode = 400;
    let errorResponse = {
      success: false,
      error: error.message,
      errorCode: error.errorCode || 'WEBHOOK_ERROR',
    };

    if (error instanceof SignatureVerificationError || error instanceof InvalidChecksumError) {
      statusCode = 401;
      errorResponse.securityAlert = true;
      logger.error('Webhook security violation', {
        error: error.message,
        errorCode: error.errorCode,
        orderId: webhookData.ORDERID,
        ...securityContext,
        severity: 'CRITICAL',
      });
    } else if (error instanceof PaymentError) {
      statusCode = error.statusCode;
      if (error.details) {
        errorResponse.details = error.details;
      }
    }

    // Store failed attempt if idempotency key exists
    if (idempotencyKey) {
      storeIdempotencyKey(idempotencyKey, errorResponse, 'failed');
    }

    logger.error('Payment webhook failed', { 
      error: error.message,
      errorType: error.name,
      errorCode: error.errorCode,
      orderId: webhookData.ORDERID,
      ...securityContext,
    });

    res.status(statusCode).json(errorResponse);
  }
});

/**
 * PUT /api/payments/:orderId/status
 * Update payment status
 */
router.put('/:orderId/status', async (req, res) => {
  try {
    const { orderId } = req.params;
    const updateData = req.body;
    
    const payment = await paymentService.updatePaymentStatus(orderId, updateData);
    
    res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    logger.error('Payment status update failed', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/payments
 * Get all payments (for testing)
 */
router.get('/', async (req, res) => {
  try {
    const payments = paymentService.getAllPayments();
    
    res.status(200).json({
      success: true,
      data: payments,
      count: payments.length,
    });
  } catch (error) {
    logger.error('Get all payments failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;

