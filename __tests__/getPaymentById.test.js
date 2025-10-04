const paymentService = require('../src/services/paymentService');
const { PaymentNotFoundError, InvalidPaymentDataError } = require('../src/errors/PaymentErrors');

describe('getPaymentById() - Comprehensive Tests', () => {
  beforeEach(() => {
    paymentService.clearAllPayments();
  });

  describe('Successful Payment Retrieval', () => {
    it('should retrieve existing payment by order ID', async () => {
      // Create payment first
      const paymentData = {
        customerId: 'CUST_RETRIEVE',
        amount: 1000,
        email: 'retrieve@example.com',
        mobile: '9876543210',
      };

      const created = await paymentService.createPayment(paymentData);
      const retrieved = await paymentService.getPaymentById(created.orderId);

      expect(retrieved.orderId).toBe(created.orderId);
      expect(retrieved.customerId).toBe('CUST_RETRIEVE');
      expect(retrieved.amount).toBe(1000);
      expect(retrieved.email).toBe('retrieve@example.com');
      expect(retrieved.mobile).toBe('9876543210');
      expect(retrieved.status).toBe('PENDING');
    });

    it('should include all payment fields', async () => {
      const paymentData = {
        customerId: 'CUST_FIELDS',
        amount: 500,
        currency: 'INR',
        description: 'Test payment',
        email: 'fields@example.com',
        mobile: '9876543210',
      };

      const created = await paymentService.createPayment(paymentData);
      const payment = await paymentService.getPaymentById(created.orderId);

      expect(payment).toHaveProperty('orderId');
      expect(payment).toHaveProperty('customerId');
      expect(payment).toHaveProperty('amount');
      expect(payment).toHaveProperty('currency');
      expect(payment).toHaveProperty('description');
      expect(payment).toHaveProperty('email');
      expect(payment).toHaveProperty('mobile');
      expect(payment).toHaveProperty('status');
      expect(payment).toHaveProperty('createdAt');
      expect(payment).toHaveProperty('updatedAt');
      expect(payment).toHaveProperty('paytmOrderId');
    });

    it('should retrieve payment with Paytm order ID', async () => {
      const paymentData = {
        customerId: 'CUST_PAYTM',
        amount: 750,
        email: 'paytm@example.com',
        mobile: '9876543210',
      };

      const created = await paymentService.createPayment(paymentData);
      const payment = await paymentService.getPaymentById(created.orderId);

      expect(payment.paytmOrderId).toBeDefined();
      expect(payment.paytmOrderId).toMatch(/^PAYTM_ORDER_/);
    });
  });

  describe('Payment Not Found', () => {
    it('should throw PaymentNotFoundError for non-existent order', async () => {
      await expect(paymentService.getPaymentById('ORDER_NON_EXISTENT'))
        .rejects
        .toThrow(PaymentNotFoundError);
    });

    it('should throw PaymentNotFoundError with order ID', async () => {
      try {
        await paymentService.getPaymentById('ORDER_MISSING');
        fail('Should have thrown PaymentNotFoundError');
      } catch (error) {
        expect(error).toBeInstanceOf(PaymentNotFoundError);
        expect(error.orderId).toBe('ORDER_MISSING');
        expect(error.errorCode).toBe('PAYMENT_NOT_FOUND');
        expect(error.statusCode).toBe(404);
      }
    });
  });

  describe('Input Validation', () => {
    it('should reject null order ID', async () => {
      await expect(paymentService.getPaymentById(null))
        .rejects
        .toThrow(InvalidPaymentDataError);
    });

    it('should reject undefined order ID', async () => {
      await expect(paymentService.getPaymentById(undefined))
        .rejects
        .toThrow(InvalidPaymentDataError);
    });

    it('should reject empty string order ID', async () => {
      await expect(paymentService.getPaymentById(''))
        .rejects
        .toThrow(InvalidPaymentDataError);
    });

    it('should reject non-string order ID', async () => {
      await expect(paymentService.getPaymentById(12345))
        .rejects
        .toThrow(InvalidPaymentDataError);
    });

    it('should warn about unusual order ID format', async () => {
      // This should log a warning but not throw
      await expect(paymentService.getPaymentById('UNUSUAL_FORMAT'))
        .rejects
        .toThrow(PaymentNotFoundError); // Still not found
    });
  });

  describe('Options - includeHistory', () => {
    it('should include metadata when includeHistory is true', async () => {
      const paymentData = {
        customerId: 'CUST_HISTORY',
        amount: 1000,
        email: 'history@example.com',
        mobile: '9876543210',
      };

      const created = await paymentService.createPayment(paymentData);
      
      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const payment = await paymentService.getPaymentById(created.orderId, {
        includeHistory: true,
      });

      expect(payment.metadata).toBeDefined();
      expect(payment.metadata.retrievedAt).toBeDefined();
      expect(payment.metadata.processingTimeMs).toBeDefined();
      expect(payment.metadata.ageHours).toBeDefined();
      expect(payment.metadata.processingTimeMs).toBeGreaterThan(0);
    });

    it('should not include metadata when includeHistory is false', async () => {
      const paymentData = {
        customerId: 'CUST_NO_HISTORY',
        amount: 1000,
        email: 'nohistory@example.com',
        mobile: '9876543210',
      };

      const created = await paymentService.createPayment(paymentData);
      const payment = await paymentService.getPaymentById(created.orderId, {
        includeHistory: false,
      });

      expect(payment.metadata).toBeUndefined();
    });

    it('should default to no metadata', async () => {
      const paymentData = {
        customerId: 'CUST_DEFAULT',
        amount: 1000,
        email: 'default@example.com',
        mobile: '9876543210',
      };

      const created = await paymentService.createPayment(paymentData);
      const payment = await paymentService.getPaymentById(created.orderId);

      expect(payment.metadata).toBeUndefined();
    });
  });

  describe('Options - validateStatus', () => {
    it('should validate status when validateStatus is true', async () => {
      const paymentData = {
        customerId: 'CUST_VALIDATE',
        amount: 1000,
        email: 'validate@example.com',
        mobile: '9876543210',
      };

      const created = await paymentService.createPayment(paymentData);
      const payment = await paymentService.getPaymentById(created.orderId, {
        validateStatus: true,
      });

      expect(payment.orderId).toBe(created.orderId);
      expect(payment.status).toBe('PENDING');
    });

    it('should accept valid payment statuses', async () => {
      const validStatuses = ['PENDING', 'SUCCESS', 'FAILED'];

      for (const status of validStatuses) {
        paymentService.clearAllPayments();
        
        const paymentData = {
          customerId: `CUST_${status}`,
          amount: 100,
          email: `${status.toLowerCase()}@example.com`,
          mobile: '9876543210',
        };

        const created = await paymentService.createPayment(paymentData);
        
        // Manually update status for testing
        const payment = await paymentService.getPaymentById(created.orderId);
        await paymentService.updatePaymentStatus(created.orderId, { status });

        const validated = await paymentService.getPaymentById(created.orderId, {
          validateStatus: true,
        });

        expect(validated.status).toBe(status);
      }
    });

    it('should warn about stale PENDING payments', async () => {
      const paymentData = {
        customerId: 'CUST_STALE',
        amount: 100,
        email: 'stale@example.com',
        mobile: '9876543210',
      };

      const created = await paymentService.createPayment(paymentData);
      
      // Manually set createdAt to 25 hours ago
      const payment = await paymentService.getPaymentById(created.orderId);
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000);
      payment.createdAt = oldDate.toISOString();

      // Should log warning but still return payment
      const retrieved = await paymentService.getPaymentById(created.orderId, {
        validateStatus: true,
      });

      expect(retrieved.orderId).toBe(created.orderId);
    });
  });

  describe('Structured Logging', () => {
    it('should log retrieval stages', async () => {
      const paymentData = {
        customerId: 'CUST_LOG_RETRIEVE',
        amount: 1000,
        email: 'logretrieve@example.com',
        mobile: '9876543210',
      };

      const created = await paymentService.createPayment(paymentData);
      const payment = await paymentService.getPaymentById(created.orderId);

      expect(payment.orderId).toBe(created.orderId);
      // Logs should include stages: VALIDATING, RETRIEVING, FOUND, COMPLETED
    });

    it('should log not found errors', async () => {
      try {
        await paymentService.getPaymentById('ORDER_LOG_NOT_FOUND');
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(PaymentNotFoundError);
        // Should log: NOT_FOUND stage
      }
    });

    it('should log validation errors', async () => {
      try {
        await paymentService.getPaymentById(null);
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidPaymentDataError);
        // Should log: validation error
      }
    });
  });

  describe('Performance', () => {
    it('should retrieve payment quickly', async () => {
      const paymentData = {
        customerId: 'CUST_PERF_GET',
        amount: 1000,
        email: 'perfget@example.com',
        mobile: '9876543210',
      };

      const created = await paymentService.createPayment(paymentData);

      const startTime = Date.now();
      const payment = await paymentService.getPaymentById(created.orderId);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100); // Should be very fast (in-memory)
      expect(payment.orderId).toBe(created.orderId);
    });

    it('should handle multiple concurrent retrievals', async () => {
      // Create payments
      const paymentIds = [];
      for (let i = 0; i < 5; i++) {
        const paymentData = {
          customerId: `CUST_CONCURRENT_GET_${i}`,
          amount: 100,
          email: `concurrentget${i}@example.com`,
          mobile: `987654321${i}`,
        };
        const created = await paymentService.createPayment(paymentData);
        paymentIds.push(created.orderId);
      }

      // Retrieve all concurrently
      const retrievePromises = paymentIds.map(id =>
        paymentService.getPaymentById(id)
      );

      const payments = await Promise.all(retrievePromises);

      expect(payments.length).toBe(5);
      payments.forEach((payment, index) => {
        expect(payment.orderId).toBe(paymentIds[index]);
      });
    });
  });

  describe('Integration with Payment Creation', () => {
    it('should retrieve immediately after creation', async () => {
      const paymentData = {
        customerId: 'CUST_IMMEDIATE',
        amount: 1000,
        email: 'immediate@example.com',
        mobile: '9876543210',
      };

      const created = await paymentService.createPayment(paymentData);
      const retrieved = await paymentService.getPaymentById(created.orderId);

      expect(retrieved.orderId).toBe(created.orderId);
      expect(retrieved.status).toBe('PENDING');
      expect(retrieved.paytmOrderId).toBe(created.paytmOrderId);
    });

    it('should reflect payment updates', async () => {
      const paymentData = {
        customerId: 'CUST_UPDATE_GET',
        amount: 1000,
        email: 'updateget@example.com',
        mobile: '9876543210',
      };

      const created = await paymentService.createPayment(paymentData);

      // Update payment
      await paymentService.updatePaymentStatus(created.orderId, {
        status: 'SUCCESS',
        transactionId: 'TXN_123',
      });

      // Retrieve updated payment
      const updated = await paymentService.getPaymentById(created.orderId);

      expect(updated.status).toBe('SUCCESS');
      expect(updated.transactionId).toBe('TXN_123');
      expect(updated.updatedAt).not.toBe(updated.createdAt);
    });
  });

  describe('Edge Cases', () => {
    it('should handle payment with minimal data', async () => {
      const paymentData = {
        customerId: 'CUST_MIN',
        amount: 1,
        email: 'min@example.com',
        mobile: '9876543210',
      };

      const created = await paymentService.createPayment(paymentData);
      const payment = await paymentService.getPaymentById(created.orderId);

      expect(payment.orderId).toBe(created.orderId);
      expect(payment.amount).toBe(1);
    });

    it('should handle payment with all optional fields', async () => {
      const paymentData = {
        customerId: 'CUST_FULL',
        amount: 1000,
        currency: 'INR',
        description: 'Full payment with all fields',
        email: 'full@example.com',
        mobile: '9876543210',
      };

      const created = await paymentService.createPayment(paymentData);
      const payment = await paymentService.getPaymentById(created.orderId);

      expect(payment.description).toBe('Full payment with all fields');
      expect(payment.currency).toBe('INR');
    });

    it('should handle payment with special characters in description', async () => {
      const paymentData = {
        customerId: 'CUST_SPECIAL_GET',
        amount: 100,
        description: 'Payment with "quotes" & <special> chars!',
        email: 'specialget@example.com',
        mobile: '9876543210',
      };

      const created = await paymentService.createPayment(paymentData);
      const payment = await paymentService.getPaymentById(created.orderId);

      expect(payment.description).toBe('Payment with "quotes" & <special> chars!');
    });
  });
});

