const express = require('express');
const router = express.Router();
const paymentService = require('../services/paymentService');
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');

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
 * Paytm callback endpoint
 */
router.post('/callback', async (req, res) => {
  try {
    const callbackData = req.body;
    const result = await paymentService.handlePaymentWebhook(callbackData);
    
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
    logger.error('Payment callback failed', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/payments/webhook
 * Paytm webhook endpoint
 */
router.post('/webhook', async (req, res) => {
  try {
    const webhookData = req.body;
    const result = await paymentService.handlePaymentWebhook(webhookData);
    
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
    logger.error('Payment webhook failed', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message,
    });
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

