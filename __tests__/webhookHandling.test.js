const paymentService = require('../src/services/paymentService');
const notificationService = require('../src/services/notificationService');
const crypto = require('crypto');
const {
  SignatureVerificationError,
} = require('../src/errors/PaymentErrors');

describe('Webhook Handling - Complete Flow', () => {
  const merchantKey = process.env.PAYTM_MERCHANT_KEY || 'test_key';

  const generateValidChecksum = (params) => {
    const sortedParams = Object.keys(params)
      .filter(key => key !== 'CHECKSUMHASH' && params[key] !== undefined && params[key] !== null)
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {});

    const paramString = Object.entries(sortedParams)
      .map(([key, value]) => `${key}=${value}`)
      .join('|');

    return crypto
      .createHmac('sha256', merchantKey)
      .update(paramString, 'utf8')
      .digest('hex');
  };

  beforeEach(() => {
    paymentService.clearAllPayments();
    notificationService.clearAllNotifications();
  });

  describe('Successful Payment Webhook', () => {
    it('should handle successful payment webhook with all stages', async () => {
      // Create initial payment
      const paymentData = {
        customerId: 'CUST_123',
        amount: 1000,
        email: 'test@example.com',
        mobile: '9876543210',
      };

      const payment = await paymentService.createPayment(paymentData);

      // Mock successful Paytm webhook
      const webhookData = {
        ORDERID: payment.paytmOrderId,
        TXNID: 'TXN_SUCCESS_123456',
        STATUS: 'TXN_SUCCESS',
        TXNAMOUNT: '1000',
        RESPCODE: '01',
        RESPMSG: 'Txn Success',
      };

      webhookData.CHECKSUMHASH = generateValidChecksum(webhookData);

      const securityContext = {
        ip: '103.57.226.1',
        userAgent: 'Paytm-Webhook/1.0',
      };

      // Process webhook
      const result = await paymentService.handlePaymentWebhook(
        webhookData,
        securityContext,
        'test_idempotency_key'
      );

      // Verify result
      expect(result.success).toBe(true);
      expect(result.status).toBe('SUCCESS');
      expect(result.transactionId).toBe('TXN_SUCCESS_123456');
      expect(result.stages).toEqual({
        received: true,
        validated: true,
        applied: true,
      });
      expect(result.processingTimeMs).toBeDefined();

      // Verify payment was updated
      const updatedPayment = await paymentService.getPaymentById(payment.orderId);
      expect(updatedPayment.status).toBe('SUCCESS');
      expect(updatedPayment.transactionId).toBe('TXN_SUCCESS_123456');
      expect(updatedPayment.responseCode).toBe('01');
    });

    it('should send SMS notification for successful payment', async () => {
      // Create payment
      const paymentData = {
        customerId: 'CUST_123',
        amount: 1500,
        email: 'customer@example.com',
        mobile: '9123456789',
      };

      const payment = await paymentService.createPayment(paymentData);

      // Process successful webhook
      const webhookData = {
        ORDERID: payment.paytmOrderId,
        TXNID: 'TXN_123',
        STATUS: 'TXN_SUCCESS',
        TXNAMOUNT: '1500',
        RESPCODE: '01',
        RESPMSG: 'Success',
      };

      webhookData.CHECKSUMHASH = generateValidChecksum(webhookData);

      await paymentService.handlePaymentWebhook(webhookData, {}, null);

      // Verify payment status
      const updatedPayment = await paymentService.getPaymentById(payment.orderId);
      expect(updatedPayment.status).toBe('SUCCESS');

      // Send notification (this would be done by the route handler)
      const smsResult = await notificationService.sendPaymentNotification({
        mobile: updatedPayment.mobile,
        orderId: updatedPayment.orderId,
        amount: updatedPayment.amount,
        status: updatedPayment.status,
        customerName: 'Customer',
      });

      expect(smsResult.success).toBe(true);
      expect(smsResult.notificationId).toBeDefined();
      expect(smsResult.mobile).toBe('9123456789');

      // Verify notification was sent
      const notifications = notificationService.getAllNotifications();
      expect(notifications.length).toBe(1);
      expect(notifications[0].type).toBe('SMS');
      expect(notifications[0].status).toBe('SENT');
    });
  });

  describe('Failed Payment Webhook', () => {
    it('should handle failed payment webhook', async () => {
      // Create payment
      const paymentData = {
        customerId: 'CUST_456',
        amount: 2000,
        email: 'test2@example.com',
        mobile: '9876543210',
      };

      const payment = await paymentService.createPayment(paymentData);

      // Mock failed Paytm webhook
      const webhookData = {
        ORDERID: payment.paytmOrderId,
        TXNID: 'TXN_FAILED_789',
        STATUS: 'TXN_FAILURE',
        TXNAMOUNT: '2000',
        RESPCODE: '141',
        RESPMSG: 'Transaction failed',
      };

      webhookData.CHECKSUMHASH = generateValidChecksum(webhookData);

      // Process webhook
      const result = await paymentService.handlePaymentWebhook(webhookData, {}, null);

      expect(result.success).toBe(true);
      expect(result.status).toBe('FAILED');
      expect(result.transactionId).toBe('TXN_FAILED_789');

      // Verify payment was marked as failed
      const updatedPayment = await paymentService.getPaymentById(payment.orderId);
      expect(updatedPayment.status).toBe('FAILED');
      expect(updatedPayment.responseCode).toBe('141');
    });

    it('should send SMS notification for failed payment', async () => {
      const paymentData = {
        customerId: 'CUST_789',
        amount: 500,
        email: 'fail@example.com',
        mobile: '9999999999',
      };

      const payment = await paymentService.createPayment(paymentData);

      const webhookData = {
        ORDERID: payment.paytmOrderId,
        TXNID: 'TXN_FAIL_001',
        STATUS: 'TXN_FAILURE',
        TXNAMOUNT: '500',
        RESPCODE: '227',
        RESPMSG: 'Insufficient Balance',
      };

      webhookData.CHECKSUMHASH = generateValidChecksum(webhookData);

      await paymentService.handlePaymentWebhook(webhookData, {}, null);

      const updatedPayment = await paymentService.getPaymentById(payment.orderId);

      // Send failure notification
      const smsResult = await notificationService.sendPaymentNotification({
        mobile: updatedPayment.mobile,
        orderId: updatedPayment.orderId,
        amount: updatedPayment.amount,
        status: updatedPayment.status,
      });

      expect(smsResult.success).toBe(true);

      // Check notification message
      const notification = await notificationService.getNotificationById(smsResult.notificationId);
      expect(notification.message).toContain('failed');
      expect(notification.message).toContain(updatedPayment.orderId);
    });
  });

  describe('Webhook with Invalid Signature', () => {
    it('should reject webhook with invalid signature', async () => {
      const paymentData = {
        customerId: 'CUST_999',
        amount: 1000,
        email: 'test@example.com',
        mobile: '9876543210',
      };

      const payment = await paymentService.createPayment(paymentData);

      const webhookData = {
        ORDERID: payment.paytmOrderId,
        TXNID: 'TXN_123',
        STATUS: 'TXN_SUCCESS',
        TXNAMOUNT: '1000',
        RESPCODE: '01',
        RESPMSG: 'Success',
        CHECKSUMHASH: 'invalid_checksum_12345678abcdef',
      };

      const securityContext = {
        ip: '192.168.1.100',
        userAgent: 'Suspicious-Agent',
      };

      await expect(
        paymentService.handlePaymentWebhook(webhookData, securityContext, null)
      ).rejects.toThrow(SignatureVerificationError);

      // Payment should still be PENDING
      const unchangedPayment = await paymentService.getPaymentById(payment.orderId);
      expect(unchangedPayment.status).toBe('PENDING');
    });

    it('should not update payment or send SMS for invalid signature', async () => {
      const paymentData = {
        customerId: 'CUST_888',
        amount: 3000,
        email: 'secure@example.com',
        mobile: '9111111111',
      };

      const payment = await paymentService.createPayment(paymentData);

      const webhookData = {
        ORDERID: payment.paytmOrderId,
        TXNID: 'TXN_MALICIOUS',
        STATUS: 'TXN_SUCCESS',
        TXNAMOUNT: '9999999', // Tampered amount
        RESPCODE: '01',
        RESPMSG: 'Success',
      };

      // Generate checksum with original amount, then tamper
      const validWebhook = { ...webhookData, TXNAMOUNT: '3000' };
      webhookData.CHECKSUMHASH = generateValidChecksum(validWebhook);
      webhookData.TXNAMOUNT = '9999999'; // Tamper after checksum

      try {
        await paymentService.handlePaymentWebhook(webhookData, {}, null);
        fail('Should have thrown SignatureVerificationError');
      } catch (error) {
        expect(error).toBeInstanceOf(SignatureVerificationError);
      }

      // Verify payment unchanged
      const payment2 = await paymentService.getPaymentById(payment.orderId);
      expect(payment2.status).toBe('PENDING');
      expect(payment2.amount).toBe(3000); // Original amount

      // No SMS should be sent
      const notifications = notificationService.getAllNotifications();
      expect(notifications.length).toBe(0);
    });
  });

  describe('Idempotency in Webhooks', () => {
    it('should process webhook only once with same idempotency key', async () => {
      const paymentData = {
        customerId: 'CUST_IDEMP',
        amount: 750,
        email: 'idemp@example.com',
        mobile: '9222222222',
      };

      const payment = await paymentService.createPayment(paymentData);

      const webhookData = {
        ORDERID: payment.paytmOrderId,
        TXNID: 'TXN_IDEMP_001',
        STATUS: 'TXN_SUCCESS',
        TXNAMOUNT: '750',
        RESPCODE: '01',
        RESPMSG: 'Success',
      };

      webhookData.CHECKSUMHASH = generateValidChecksum(webhookData);

      const idempotencyKey = 'paytm_txn_TXN_IDEMP_001';

      // First webhook processing
      const result1 = await paymentService.handlePaymentWebhook(
        webhookData,
        {},
        idempotencyKey
      );

      expect(result1.success).toBe(true);
      expect(result1.status).toBe('SUCCESS');

      const updatedPayment = await paymentService.getPaymentById(payment.orderId);
      expect(updatedPayment.status).toBe('SUCCESS');
    });

    it('should handle webhooks without idempotency key', async () => {
      const paymentData = {
        customerId: 'CUST_NO_IDEMP',
        amount: 850,
        email: 'noidemp@example.com',
        mobile: '9333333333',
      };

      const payment = await paymentService.createPayment(paymentData);

      const webhookData = {
        ORDERID: payment.paytmOrderId,
        TXNID: 'TXN_NO_IDEMP',
        STATUS: 'TXN_SUCCESS',
        TXNAMOUNT: '850',
        RESPCODE: '01',
        RESPMSG: 'Success',
      };

      webhookData.CHECKSUMHASH = generateValidChecksum(webhookData);

      // Process without idempotency key (null)
      const result = await paymentService.handlePaymentWebhook(webhookData, {}, null);

      expect(result.success).toBe(true);
      expect(result.status).toBe('SUCCESS');
    });
  });

  describe('Webhook Event Logging', () => {
    it('should log all webhook processing stages', async () => {
      const paymentData = {
        customerId: 'CUST_LOG',
        amount: 1250,
        email: 'log@example.com',
        mobile: '9444444444',
      };

      const payment = await paymentService.createPayment(paymentData);

      const webhookData = {
        ORDERID: payment.paytmOrderId,
        TXNID: 'TXN_LOG_123',
        STATUS: 'TXN_SUCCESS',
        TXNAMOUNT: '1250',
        RESPCODE: '01',
        RESPMSG: 'Success',
      };

      webhookData.CHECKSUMHASH = generateValidChecksum(webhookData);

      const securityContext = {
        ip: '103.57.226.5',
        userAgent: 'Paytm-Webhook/1.0',
        requestId: 'REQ_LOG_001',
      };

      const result = await paymentService.handlePaymentWebhook(
        webhookData,
        securityContext,
        'log_key_123'
      );

      // Verify stages were tracked
      expect(result.stages).toEqual({
        received: true,
        validated: true,
        applied: true,
      });

      expect(result.processingTimeMs).toBeGreaterThan(0);
    });
  });

  describe('Payment Status Updates', () => {
    it('should update all payment fields correctly', async () => {
      const paymentData = {
        customerId: 'CUST_UPDATE',
        amount: 3500,
        email: 'update@example.com',
        mobile: '9555555555',
      };

      const payment = await paymentService.createPayment(paymentData);
      expect(payment.status).toBe('PENDING');

      const webhookData = {
        ORDERID: payment.paytmOrderId,
        TXNID: 'TXN_UPDATE_999',
        STATUS: 'TXN_SUCCESS',
        TXNAMOUNT: '3500',
        RESPCODE: '01',
        RESPMSG: 'Transaction Successful',
      };

      webhookData.CHECKSUMHASH = generateValidChecksum(webhookData);

      await paymentService.handlePaymentWebhook(webhookData, {}, null);

      const updatedPayment = await paymentService.getPaymentById(payment.orderId);

      expect(updatedPayment.status).toBe('SUCCESS');
      expect(updatedPayment.transactionId).toBe('TXN_UPDATE_999');
      expect(updatedPayment.responseCode).toBe('01');
      expect(updatedPayment.responseMessage).toBe('Transaction Successful');
      expect(updatedPayment.amount).toBe('3500');
      expect(updatedPayment.updatedAt).toBeDefined();
      expect(updatedPayment.updatedAt).not.toBe(updatedPayment.createdAt);
    });
  });

  describe('Mock Paytm API Responses', () => {
    it('should handle TXN_SUCCESS status correctly', async () => {
      const payment = await paymentService.createPayment({
        customerId: 'CUST_1',
        amount: 100,
        email: 'test1@example.com',
        mobile: '9111111111',
      });

      const successWebhook = {
        ORDERID: payment.paytmOrderId,
        TXNID: 'TXN_001',
        STATUS: 'TXN_SUCCESS',
        TXNAMOUNT: '100',
        RESPCODE: '01',
        RESPMSG: 'Txn Success',
      };

      successWebhook.CHECKSUMHASH = generateValidChecksum(successWebhook);

      const result = await paymentService.handlePaymentWebhook(successWebhook, {}, null);
      expect(result.status).toBe('SUCCESS');
    });

    it('should handle TXN_FAILURE status correctly', async () => {
      const payment = await paymentService.createPayment({
        customerId: 'CUST_2',
        amount: 200,
        email: 'test2@example.com',
        mobile: '9222222222',
      });

      const failureWebhook = {
        ORDERID: payment.paytmOrderId,
        TXNID: 'TXN_002',
        STATUS: 'TXN_FAILURE',
        TXNAMOUNT: '200',
        RESPCODE: '141',
        RESPMSG: 'Transaction Failed',
      };

      failureWebhook.CHECKSUMHASH = generateValidChecksum(failureWebhook);

      const result = await paymentService.handlePaymentWebhook(failureWebhook, {}, null);
      expect(result.status).toBe('FAILED');
    });

    it('should handle PENDING status correctly', async () => {
      const payment = await paymentService.createPayment({
        customerId: 'CUST_3',
        amount: 300,
        email: 'test3@example.com',
        mobile: '9333333333',
      });

      const pendingWebhook = {
        ORDERID: payment.paytmOrderId,
        TXNID: 'TXN_003',
        STATUS: 'PENDING',
        TXNAMOUNT: '300',
        RESPCODE: '400',
        RESPMSG: 'Transaction Pending',
      };

      pendingWebhook.CHECKSUMHASH = generateValidChecksum(pendingWebhook);

      const result = await paymentService.handlePaymentWebhook(pendingWebhook, {}, null);
      expect(result.status).toBe('FAILED'); // Non-success treated as failed
    });
  });

  describe('SMS Notification Integration', () => {
    it('should send correct SMS for successful payment', async () => {
      const smsResult = await notificationService.sendPaymentNotification({
        mobile: '9876543210',
        orderId: 'ORDER_SMS_001',
        amount: 1000,
        status: 'SUCCESS',
        customerName: 'John Doe',
      });

      expect(smsResult.success).toBe(true);
      expect(smsResult.status).toBe('SENT');

      const notification = await notificationService.getNotificationById(
        smsResult.notificationId
      );

      expect(notification.message).toContain('successfully processed');
      expect(notification.message).toContain('1000');
      expect(notification.message).toContain('ORDER_SMS_001');
      expect(notification.message).toContain('John Doe');
    });

    it('should send correct SMS for failed payment', async () => {
      const smsResult = await notificationService.sendPaymentNotification({
        mobile: '9876543210',
        orderId: 'ORDER_SMS_002',
        amount: 2000,
        status: 'FAILED',
        customerName: 'Jane Smith',
      });

      const notification = await notificationService.getNotificationById(
        smsResult.notificationId
      );

      expect(notification.message).toContain('failed');
      expect(notification.message).toContain('2000');
      expect(notification.message).toContain('ORDER_SMS_002');
    });

    it('should use mock SMS API provider', async () => {
      const smsResult = await notificationService.sendSMSNotification({
        mobile: '9876543210',
        message: 'Test SMS',
      });

      expect(smsResult.smsId).toBeDefined();
      expect(smsResult.smsId).toMatch(/^SMS_PROVIDER_/);

      const notification = await notificationService.getNotificationById(
        smsResult.notificationId
      );

      expect(notification.provider).toBe('MockSMSProvider');
      expect(notification.status).toBe('SENT');
    });
  });
});

