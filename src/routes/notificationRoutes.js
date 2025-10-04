const express = require('express');
const router = express.Router();
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');

/**
 * POST /api/notifications/sms
 * Send SMS notification
 */
router.post('/sms', async (req, res) => {
  try {
    const smsData = req.body;
    const result = await notificationService.sendSMSNotification(smsData);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('SMS sending failed', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/notifications/payment
 * Send payment notification SMS
 */
router.post('/payment', async (req, res) => {
  try {
    const paymentData = req.body;
    const result = await notificationService.sendPaymentNotification(paymentData);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Payment notification failed', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/notifications/:notificationId
 * Get notification by ID
 */
router.get('/:notificationId', async (req, res) => {
  try {
    const { notificationId } = req.params;
    const notification = await notificationService.getNotificationById(notificationId);
    
    res.status(200).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    logger.error('Get notification failed', { error: error.message });
    res.status(404).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/notifications
 * Get all notifications (for testing)
 */
router.get('/', async (req, res) => {
  try {
    const notifications = notificationService.getAllNotifications();
    
    res.status(200).json({
      success: true,
      data: notifications,
      count: notifications.length,
    });
  } catch (error) {
    logger.error('Get all notifications failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;

