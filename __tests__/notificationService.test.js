const notificationService = require('../src/services/notificationService');

describe('Notification Service', () => {
  beforeEach(() => {
    // Clear all notifications before each test
    notificationService.clearAllNotifications();
  });

  describe('sendSMSNotification', () => {
    it('should send SMS successfully', async () => {
      const smsData = {
        mobile: '9876543210',
        message: 'Test SMS message',
        templateId: 'TEST_TEMPLATE',
      };

      const result = await notificationService.sendSMSNotification(smsData);

      expect(result.success).toBe(true);
      expect(result.notificationId).toBeDefined();
      expect(result.smsId).toBeDefined();
      expect(result.mobile).toBe('9876543210');
      expect(result.status).toBe('SENT');
      expect(result.sentAt).toBeDefined();
    });

    it('should throw error for missing mobile number', async () => {
      const smsData = {
        message: 'Test message',
      };

      await expect(notificationService.sendSMSNotification(smsData))
        .rejects
        .toThrow('Missing required fields');
    });

    it('should throw error for missing message', async () => {
      const smsData = {
        mobile: '9876543210',
      };

      await expect(notificationService.sendSMSNotification(smsData))
        .rejects
        .toThrow('Missing required fields');
    });

    it('should throw error for invalid mobile number format', async () => {
      const smsData = {
        mobile: '12345',
        message: 'Test message',
      };

      await expect(notificationService.sendSMSNotification(smsData))
        .rejects
        .toThrow('Invalid mobile number format');
    });

    it('should accept valid 10-digit mobile number', async () => {
      const smsData = {
        mobile: '9123456789',
        message: 'Test message',
      };

      const result = await notificationService.sendSMSNotification(smsData);
      expect(result.success).toBe(true);
    });

    it('should handle message longer than 160 characters', async () => {
      const smsData = {
        mobile: '9876543210',
        message: 'A'.repeat(200),
      };

      const result = await notificationService.sendSMSNotification(smsData);
      expect(result.success).toBe(true);
    });
  });

  describe('sendPaymentNotification', () => {
    it('should send success payment notification', async () => {
      const paymentData = {
        mobile: '9876543210',
        orderId: 'ORDER_123',
        amount: 1000,
        status: 'SUCCESS',
        customerName: 'John Doe',
      };

      const result = await notificationService.sendPaymentNotification(paymentData);

      expect(result.success).toBe(true);
      expect(result.notificationId).toBeDefined();
      expect(result.mobile).toBe('9876543210');
    });

    it('should send failed payment notification', async () => {
      const paymentData = {
        mobile: '9876543210',
        orderId: 'ORDER_123',
        amount: 1000,
        status: 'FAILED',
        customerName: 'John Doe',
      };

      const result = await notificationService.sendPaymentNotification(paymentData);
      expect(result.success).toBe(true);
    });

    it('should send pending payment notification', async () => {
      const paymentData = {
        mobile: '9876543210',
        orderId: 'ORDER_123',
        amount: 1000,
        status: 'PENDING',
        customerName: 'John Doe',
      };

      const result = await notificationService.sendPaymentNotification(paymentData);
      expect(result.success).toBe(true);
    });

    it('should handle payment notification without customer name', async () => {
      const paymentData = {
        mobile: '9876543210',
        orderId: 'ORDER_123',
        amount: 1000,
        status: 'SUCCESS',
      };

      const result = await notificationService.sendPaymentNotification(paymentData);
      expect(result.success).toBe(true);
    });

    it('should handle custom payment status', async () => {
      const paymentData = {
        mobile: '9876543210',
        orderId: 'ORDER_123',
        amount: 1000,
        status: 'PROCESSING',
      };

      const result = await notificationService.sendPaymentNotification(paymentData);
      expect(result.success).toBe(true);
    });
  });

  describe('getNotificationById', () => {
    it('should retrieve existing notification', async () => {
      const smsData = {
        mobile: '9876543210',
        message: 'Test message',
      };

      const sent = await notificationService.sendSMSNotification(smsData);
      const notification = await notificationService.getNotificationById(sent.notificationId);

      expect(notification.notificationId).toBe(sent.notificationId);
      expect(notification.mobile).toBe('9876543210');
      expect(notification.message).toBe('Test message');
    });

    it('should throw error for non-existent notification', async () => {
      await expect(notificationService.getNotificationById('INVALID_ID'))
        .rejects
        .toThrow('Notification not found');
    });
  });

  describe('getAllNotifications', () => {
    it('should return all notifications', async () => {
      const smsData1 = {
        mobile: '9876543210',
        message: 'Message 1',
      };

      const smsData2 = {
        mobile: '9876543211',
        message: 'Message 2',
      };

      await notificationService.sendSMSNotification(smsData1);
      await notificationService.sendSMSNotification(smsData2);

      const notifications = notificationService.getAllNotifications();
      expect(notifications.length).toBe(2);
    });

    it('should return empty array when no notifications exist', () => {
      const notifications = notificationService.getAllNotifications();
      expect(notifications).toEqual([]);
    });
  });
});

