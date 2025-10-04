const paymentService = require('../src/services/paymentService');

describe('Payment Service', () => {
  beforeEach(() => {
    // Clear all payments before each test
    paymentService.clearAllPayments();
  });

  describe('createPayment', () => {
    it('should create a payment successfully', async () => {
      const paymentData = {
        customerId: 'CUST_123',
        amount: 1000,
        currency: 'INR',
        description: 'Test payment',
        email: 'test@example.com',
        mobile: '9876543210',
      };

      const result = await paymentService.createPayment(paymentData);

      expect(result.success).toBe(true);
      expect(result.orderId).toBeDefined();
      expect(result.paytmOrderId).toBeDefined();
      expect(result.txnToken).toBeDefined();
      expect(result.amount).toBe(1000);
      expect(result.currency).toBe('INR');
      expect(result.status).toBe('PENDING');
    });

    it('should throw error for missing required fields', async () => {
      const paymentData = {
        amount: 1000,
        email: 'test@example.com',
      };

      await expect(paymentService.createPayment(paymentData))
        .rejects
        .toThrow('Missing required fields');
    });

    it('should throw error for invalid amount', async () => {
      const paymentData = {
        customerId: 'CUST_123',
        amount: -100,
        email: 'test@example.com',
        mobile: '9876543210',
      };

      await expect(paymentService.createPayment(paymentData))
        .rejects
        .toThrow('Amount must be greater than 0');
    });

    it('should default to INR currency if not specified', async () => {
      const paymentData = {
        customerId: 'CUST_123',
        amount: 1000,
        email: 'test@example.com',
        mobile: '9876543210',
      };

      const result = await paymentService.createPayment(paymentData);
      expect(result.currency).toBe('INR');
    });
  });

  describe('getPaymentById', () => {
    it('should retrieve an existing payment', async () => {
      const paymentData = {
        customerId: 'CUST_123',
        amount: 1000,
        email: 'test@example.com',
        mobile: '9876543210',
      };

      const created = await paymentService.createPayment(paymentData);
      const payment = await paymentService.getPaymentById(created.orderId);

      expect(payment.orderId).toBe(created.orderId);
      expect(payment.customerId).toBe('CUST_123');
      expect(payment.amount).toBe(1000);
    });

    it('should throw error for non-existent payment', async () => {
      await expect(paymentService.getPaymentById('INVALID_ORDER_ID'))
        .rejects
        .toThrow('Payment not found');
    });
  });

  describe('updatePaymentStatus', () => {
    it('should update payment status successfully', async () => {
      const paymentData = {
        customerId: 'CUST_123',
        amount: 1000,
        email: 'test@example.com',
        mobile: '9876543210',
      };

      const created = await paymentService.createPayment(paymentData);
      
      const updateData = {
        status: 'SUCCESS',
        transactionId: 'TXN_12345',
        responseCode: '01',
        responseMessage: 'Success',
      };

      const updated = await paymentService.updatePaymentStatus(created.orderId, updateData);

      expect(updated.status).toBe('SUCCESS');
      expect(updated.transactionId).toBe('TXN_12345');
      expect(updated.responseCode).toBe('01');
      expect(updated.updatedAt).toBeDefined();
    });

    it('should throw error for non-existent payment', async () => {
      await expect(
        paymentService.updatePaymentStatus('INVALID_ID', { status: 'SUCCESS' })
      ).rejects.toThrow('Payment not found');
    });

    it('should handle Paytm order ID format', async () => {
      const paymentData = {
        customerId: 'CUST_123',
        amount: 1000,
        email: 'test@example.com',
        mobile: '9876543210',
      };

      const created = await paymentService.createPayment(paymentData);
      const paytmOrderId = `PAYTM_${created.orderId}`;
      
      const updated = await paymentService.updatePaymentStatus(paytmOrderId, {
        status: 'SUCCESS',
      });

      expect(updated.status).toBe('SUCCESS');
    });
  });

  describe('verifyPaytmSignature', () => {
    it('should verify valid signature', () => {
      const params = {
        ORDERID: 'ORDER_123',
        TXNID: 'TXN_123',
        TXNAMOUNT: '1000',
        STATUS: 'TXN_SUCCESS',
      };

      // Generate a mock checksum
      const crypto = require('crypto');
      const paramString = 'ORDERID=ORDER_123|STATUS=TXN_SUCCESS|TXNAMOUNT=1000|TXNID=TXN_123';
      const checksum = crypto
        .createHmac('sha256', process.env.PAYTM_MERCHANT_KEY || 'test_key')
        .update(paramString)
        .digest('hex');

      const isValid = paymentService.verifyPaytmSignature(params, checksum);
      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const params = {
        ORDERID: 'ORDER_123',
        TXNID: 'TXN_123',
        TXNAMOUNT: '1000',
        STATUS: 'TXN_SUCCESS',
      };

      const isValid = paymentService.verifyPaytmSignature(params, 'invalid_checksum');
      expect(isValid).toBe(false);
    });
  });

  describe('handlePaymentWebhook', () => {
    it('should process webhook with valid signature', async () => {
      const paymentData = {
        customerId: 'CUST_123',
        amount: 1000,
        email: 'test@example.com',
        mobile: '9876543210',
      };

      const created = await paymentService.createPayment(paymentData);
      
      const crypto = require('crypto');
      const webhookParams = {
        ORDERID: created.paytmOrderId,
        TXNID: 'TXN_123456',
        STATUS: 'TXN_SUCCESS',
        TXNAMOUNT: '1000',
        RESPCODE: '01',
        RESPMSG: 'Transaction Successful',
      };

      const paramString = 'ORDERID=' + webhookParams.ORDERID + 
                         '|RESPCODE=' + webhookParams.RESPCODE + 
                         '|RESPMSG=' + webhookParams.RESPMSG + 
                         '|STATUS=' + webhookParams.STATUS + 
                         '|TXNAMOUNT=' + webhookParams.TXNAMOUNT + 
                         '|TXNID=' + webhookParams.TXNID;
      
      const checksum = crypto
        .createHmac('sha256', process.env.PAYTM_MERCHANT_KEY || 'test_key')
        .update(paramString)
        .digest('hex');

      webhookParams.CHECKSUMHASH = checksum;

      const result = await paymentService.handlePaymentWebhook(webhookParams);

      expect(result.success).toBe(true);
      expect(result.status).toBe('SUCCESS');
    });

    it('should reject webhook with invalid signature', async () => {
      const webhookData = {
        ORDERID: 'ORDER_123',
        TXNID: 'TXN_123',
        STATUS: 'TXN_SUCCESS',
        CHECKSUMHASH: 'invalid_checksum',
        TXNAMOUNT: '1000',
        RESPCODE: '01',
        RESPMSG: 'Success',
      };

      await expect(paymentService.handlePaymentWebhook(webhookData))
        .rejects
        .toThrow('Invalid signature');
    });
  });

  describe('getAllPayments', () => {
    it('should return all payments', async () => {
      const paymentData1 = {
        customerId: 'CUST_1',
        amount: 1000,
        email: 'test1@example.com',
        mobile: '9876543210',
      };

      const paymentData2 = {
        customerId: 'CUST_2',
        amount: 2000,
        email: 'test2@example.com',
        mobile: '9876543211',
      };

      await paymentService.createPayment(paymentData1);
      await paymentService.createPayment(paymentData2);

      const payments = paymentService.getAllPayments();
      expect(payments.length).toBe(2);
    });

    it('should return empty array when no payments exist', () => {
      const payments = paymentService.getAllPayments();
      expect(payments).toEqual([]);
    });
  });
});

