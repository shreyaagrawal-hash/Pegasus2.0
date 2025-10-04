const { v4: uuidv4 } = require('uuid');
const config = require('../config/config');
const logger = require('../utils/logger');

// In-memory storage for notification logs (use database in production)
const notifications = new Map();

/**
 * Send SMS notification
 * @param {Object} smsData - SMS information
 * @returns {Object} SMS sending result
 */
const sendSMSNotification = async (smsData) => {
  try {
    const { mobile, message, templateId } = smsData;

    // Validate required fields
    if (!mobile || !message) {
      throw new Error('Missing required fields: mobile, message');
    }

    // Validate mobile number format (basic validation)
    const mobileRegex = /^[6-9]\d{9}$/;
    if (!mobileRegex.test(mobile)) {
      throw new Error('Invalid mobile number format');
    }

    // Validate message length
    if (message.length > 160) {
      logger.warn('SMS message exceeds 160 characters', {
        mobile,
        messageLength: message.length,
      });
    }

    // Generate notification ID
    const notificationId = `SMS_${uuidv4()}`;
    const timestamp = new Date().toISOString();

    // Create notification object
    const notification = {
      notificationId,
      type: 'SMS',
      mobile,
      message,
      templateId: templateId || null,
      status: 'PENDING',
      createdAt: timestamp,
      sentAt: null,
      deliveredAt: null,
      errorMessage: null,
    };

    // Mock SMS API call
    const smsResponse = await mockSMSAPICall(notification);
    
    notification.status = smsResponse.status;
    notification.sentAt = smsResponse.sentAt;
    notification.smsId = smsResponse.smsId;
    notification.provider = smsResponse.provider;

    // Store notification
    notifications.set(notificationId, notification);

    logger.info('SMS notification sent', {
      notificationId,
      mobile,
      status: notification.status,
      smsId: smsResponse.smsId,
    });

    return {
      success: true,
      notificationId,
      smsId: notification.smsId,
      mobile,
      status: notification.status,
      sentAt: notification.sentAt,
    };
  } catch (error) {
    logger.error('Error sending SMS notification', {
      mobile: smsData.mobile,
      error: error.message,
    });
    throw error;
  }
};

/**
 * Mock SMS API call
 * @param {Object} notification - Notification object
 * @returns {Object} Mock SMS response
 */
const mockSMSAPICall = async (notification) => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 100));

  // Mock successful SMS response
  return {
    status: 'SENT',
    sentAt: new Date().toISOString(),
    smsId: `SMS_PROVIDER_${Math.random().toString(36).substring(2, 15)}`,
    provider: 'MockSMSProvider',
    resultCode: '000',
    resultMessage: 'Message sent successfully',
  };
};

/**
 * Send payment notification SMS
 * @param {Object} paymentData - Payment information
 * @returns {Object} SMS sending result
 */
const sendPaymentNotification = async (paymentData) => {
  try {
    const { mobile, orderId, amount, status, customerName } = paymentData;

    let message = '';
    
    if (status === 'SUCCESS') {
      message = `Dear ${customerName || 'Customer'}, your payment of Rs.${amount} for order ${orderId} has been successfully processed. Thank you! - Team Pegasus`;
    } else if (status === 'FAILED') {
      message = `Dear ${customerName || 'Customer'}, your payment of Rs.${amount} for order ${orderId} has failed. Please try again. - Team Pegasus`;
    } else if (status === 'PENDING') {
      message = `Dear ${customerName || 'Customer'}, your payment of Rs.${amount} for order ${orderId} is being processed. - Team Pegasus`;
    } else {
      message = `Payment update for order ${orderId}: Status - ${status}. Amount: Rs.${amount}. - Team Pegasus`;
    }

    return await sendSMSNotification({
      mobile,
      message,
      templateId: `PAYMENT_${status}`,
    });
  } catch (error) {
    logger.error('Error sending payment notification', {
      orderId: paymentData.orderId,
      error: error.message,
    });
    throw error;
  }
};

/**
 * Get notification by ID
 * @param {String} notificationId - Notification ID
 * @returns {Object} Notification details
 */
const getNotificationById = async (notificationId) => {
  try {
    const notification = notifications.get(notificationId);

    if (!notification) {
      logger.warn('Notification not found', { notificationId });
      throw new Error(`Notification not found: ${notificationId}`);
    }

    logger.info('Notification retrieved', {
      notificationId,
      status: notification.status,
    });

    return notification;
  } catch (error) {
    logger.error('Error getting notification', {
      notificationId,
      error: error.message,
    });
    throw error;
  }
};

/**
 * Get all notifications (for testing purposes)
 * @returns {Array} All notifications
 */
const getAllNotifications = () => {
  return Array.from(notifications.values());
};

/**
 * Clear all notifications (for testing purposes)
 */
const clearAllNotifications = () => {
  notifications.clear();
};

module.exports = {
  sendSMSNotification,
  sendPaymentNotification,
  getNotificationById,
  getAllNotifications,
  clearAllNotifications,
};

