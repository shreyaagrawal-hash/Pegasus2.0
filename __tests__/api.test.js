const request = require('supertest');
const app = require('../src/server');
const paymentService = require('../src/services/paymentService');
const notificationService = require('../src/services/notificationService');

describe('API Integration Tests', () => {
  beforeEach(() => {
    // Clear all data before each test
    paymentService.clearAllPayments();
    notificationService.clearAllNotifications();
  });

  describe('Health Check', () => {
    it('GET /health should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('UP');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.uptime).toBeDefined();
      expect(response.body.service).toBe('payments-notifications-service');
    });
  });

  describe('Payment APIs', () => {
    describe('POST /api/payments/create', () => {
      it('should create a new payment', async () => {
        const paymentData = {
          customerId: 'CUST_123',
          amount: 1000,
          currency: 'INR',
          description: 'Test payment',
          email: 'test@example.com',
          mobile: '9876543210',
        };

        const response = await request(app)
          .post('/api/payments/create')
          .send(paymentData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.orderId).toBeDefined();
        expect(response.body.data.amount).toBe(1000);
        expect(response.body.data.status).toBe('PENDING');
      });

      it('should return error for invalid payment data', async () => {
        const paymentData = {
          amount: 1000,
        };

        const response = await request(app)
          .post('/api/payments/create')
          .send(paymentData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBeDefined();
      });
    });

    describe('GET /api/payments/:orderId', () => {
      it('should get payment by order ID', async () => {
        const paymentData = {
          customerId: 'CUST_123',
          amount: 1000,
          email: 'test@example.com',
          mobile: '9876543210',
        };

        const createResponse = await request(app)
          .post('/api/payments/create')
          .send(paymentData);

        const orderId = createResponse.body.data.orderId;

        const response = await request(app)
          .get(`/api/payments/${orderId}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.orderId).toBe(orderId);
        expect(response.body.data.amount).toBe(1000);
      });

      it('should return 404 for non-existent order', async () => {
        const response = await request(app)
          .get('/api/payments/INVALID_ORDER_ID')
          .expect(404);

        expect(response.body.success).toBe(false);
      });
    });

    describe('PUT /api/payments/:orderId/status', () => {
      it('should update payment status', async () => {
        const paymentData = {
          customerId: 'CUST_123',
          amount: 1000,
          email: 'test@example.com',
          mobile: '9876543210',
        };

        const createResponse = await request(app)
          .post('/api/payments/create')
          .send(paymentData);

        const orderId = createResponse.body.data.orderId;

        const updateData = {
          status: 'SUCCESS',
          transactionId: 'TXN_12345',
        };

        const response = await request(app)
          .put(`/api/payments/${orderId}/status`)
          .send(updateData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('SUCCESS');
        expect(response.body.data.transactionId).toBe('TXN_12345');
      });
    });

    describe('POST /api/payments/webhook', () => {
      it('should process payment webhook', async () => {
        const paymentData = {
          customerId: 'CUST_123',
          amount: 1000,
          email: 'test@example.com',
          mobile: '9876543210',
        };

        const createResponse = await request(app)
          .post('/api/payments/create')
          .send(paymentData);

        const orderId = createResponse.body.data.paytmOrderId;

        const crypto = require('crypto');
        const webhookData = {
          ORDERID: orderId,
          TXNID: 'TXN_123456',
          STATUS: 'TXN_SUCCESS',
          TXNAMOUNT: '1000',
          RESPCODE: '01',
          RESPMSG: 'Success',
        };

        const paramString = 'ORDERID=' + webhookData.ORDERID + 
                           '|RESPCODE=' + webhookData.RESPCODE + 
                           '|RESPMSG=' + webhookData.RESPMSG + 
                           '|STATUS=' + webhookData.STATUS + 
                           '|TXNAMOUNT=' + webhookData.TXNAMOUNT + 
                           '|TXNID=' + webhookData.TXNID;
        
        const checksum = crypto
          .createHmac('sha256', process.env.PAYTM_MERCHANT_KEY || 'test_key')
          .update(paramString)
          .digest('hex');

        webhookData.CHECKSUMHASH = checksum;

        const response = await request(app)
          .post('/api/payments/webhook')
          .send(webhookData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('SUCCESS');
      });
    });

    describe('GET /api/payments', () => {
      it('should get all payments', async () => {
        const paymentData = {
          customerId: 'CUST_123',
          amount: 1000,
          email: 'test@example.com',
          mobile: '9876543210',
        };

        await request(app)
          .post('/api/payments/create')
          .send(paymentData);

        const response = await request(app)
          .get('/api/payments')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeInstanceOf(Array);
        expect(response.body.count).toBe(1);
      });
    });
  });

  describe('Notification APIs', () => {
    describe('POST /api/notifications/sms', () => {
      it('should send SMS successfully', async () => {
        const smsData = {
          mobile: '9876543210',
          message: 'Test SMS message',
        };

        const response = await request(app)
          .post('/api/notifications/sms')
          .send(smsData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.notificationId).toBeDefined();
        expect(response.body.data.status).toBe('SENT');
      });

      it('should return error for invalid SMS data', async () => {
        const smsData = {
          message: 'Test message',
        };

        const response = await request(app)
          .post('/api/notifications/sms')
          .send(smsData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBeDefined();
      });
    });

    describe('POST /api/notifications/payment', () => {
      it('should send payment notification', async () => {
        const paymentData = {
          mobile: '9876543210',
          orderId: 'ORDER_123',
          amount: 1000,
          status: 'SUCCESS',
          customerName: 'John Doe',
        };

        const response = await request(app)
          .post('/api/notifications/payment')
          .send(paymentData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.notificationId).toBeDefined();
      });
    });

    describe('GET /api/notifications/:notificationId', () => {
      it('should get notification by ID', async () => {
        const smsData = {
          mobile: '9876543210',
          message: 'Test message',
        };

        const sendResponse = await request(app)
          .post('/api/notifications/sms')
          .send(smsData);

        const notificationId = sendResponse.body.data.notificationId;

        const response = await request(app)
          .get(`/api/notifications/${notificationId}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.notificationId).toBe(notificationId);
      });

      it('should return 404 for non-existent notification', async () => {
        const response = await request(app)
          .get('/api/notifications/INVALID_ID')
          .expect(404);

        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /api/notifications', () => {
      it('should get all notifications', async () => {
        const smsData = {
          mobile: '9876543210',
          message: 'Test message',
        };

        await request(app)
          .post('/api/notifications/sms')
          .send(smsData);

        const response = await request(app)
          .get('/api/notifications')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeInstanceOf(Array);
        expect(response.body.count).toBe(1);
      });
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/api/non-existent-route')
        .expect(404);

      expect(response.body.error).toBe('Route not found');
    });
  });
});

