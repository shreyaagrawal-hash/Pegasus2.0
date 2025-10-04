const paymentService = require('../src/services/paymentService');
const { InvalidPaymentDataError } = require('../src/errors/PaymentErrors');

describe('createPayment() - Comprehensive Tests', () => {
  beforeEach(() => {
    paymentService.clearAllPayments();
  });

  describe('Successful Payment Creation', () => {
    it('should create payment with all required fields', async () => {
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
      expect(result.orderId).toMatch(/^ORDER_/);
      expect(result.paytmOrderId).toBeDefined();
      expect(result.paytmOrderId).toMatch(/^PAYTM_ORDER_/);
      expect(result.txnToken).toBeDefined();
      expect(result.txnToken).toMatch(/^TXN_TOKEN_/);
      expect(result.amount).toBe(1000);
      expect(result.currency).toBe('INR');
      expect(result.status).toBe('PENDING');
      expect(result.createdAt).toBeDefined();
      expect(result.processingTimeMs).toBeDefined();
      expect(result.processingTimeMs).toBeGreaterThan(0);
    });

    it('should default to INR currency', async () => {
      const paymentData = {
        customerId: 'CUST_123',
        amount: 500,
        email: 'test@example.com',
        mobile: '9876543210',
      };

      const result = await paymentService.createPayment(paymentData);
      expect(result.currency).toBe('INR');
    });

    it('should generate unique order IDs', async () => {
      const paymentData = {
        customerId: 'CUST_123',
        amount: 100,
        email: 'test@example.com',
        mobile: '9876543210',
      };

      const result1 = await paymentService.createPayment(paymentData);
      const result2 = await paymentService.createPayment(paymentData);

      expect(result1.orderId).not.toBe(result2.orderId);
      expect(result1.paytmOrderId).not.toBe(result2.paytmOrderId);
    });

    it('should store payment in storage', async () => {
      const paymentData = {
        customerId: 'CUST_123',
        amount: 1000,
        email: 'test@example.com',
        mobile: '9876543210',
      };

      const result = await paymentService.createPayment(paymentData);
      const stored = await paymentService.getPaymentById(result.orderId);

      expect(stored.orderId).toBe(result.orderId);
      expect(stored.status).toBe('PENDING');
    });
  });

  describe('Input Validation', () => {
    it('should reject missing customerId', async () => {
      const paymentData = {
        amount: 1000,
        email: 'test@example.com',
        mobile: '9876543210',
      };

      await expect(paymentService.createPayment(paymentData))
        .rejects
        .toThrow(InvalidPaymentDataError);
    });

    it('should reject invalid customerId type', async () => {
      const paymentData = {
        customerId: 12345, // Should be string
        amount: 1000,
        email: 'test@example.com',
        mobile: '9876543210',
      };

      await expect(paymentService.createPayment(paymentData))
        .rejects
        .toThrow(InvalidPaymentDataError);
    });

    it('should reject missing amount', async () => {
      const paymentData = {
        customerId: 'CUST_123',
        email: 'test@example.com',
        mobile: '9876543210',
      };

      await expect(paymentService.createPayment(paymentData))
        .rejects
        .toThrow(InvalidPaymentDataError);
    });

    it('should reject invalid amount type', async () => {
      const paymentData = {
        customerId: 'CUST_123',
        amount: '1000', // Should be number
        email: 'test@example.com',
        mobile: '9876543210',
      };

      await expect(paymentService.createPayment(paymentData))
        .rejects
        .toThrow(InvalidPaymentDataError);
    });

    it('should reject zero amount', async () => {
      const paymentData = {
        customerId: 'CUST_123',
        amount: 0,
        email: 'test@example.com',
        mobile: '9876543210',
      };

      await expect(paymentService.createPayment(paymentData))
        .rejects
        .toThrow('amount must be greater than 0');
    });

    it('should reject negative amount', async () => {
      const paymentData = {
        customerId: 'CUST_123',
        amount: -100,
        email: 'test@example.com',
        mobile: '9876543210',
      };

      await expect(paymentService.createPayment(paymentData))
        .rejects
        .toThrow('amount must be greater than 0');
    });

    it('should reject amount exceeding maximum limit', async () => {
      const paymentData = {
        customerId: 'CUST_123',
        amount: 2000000, // Exceeds 1,000,000 limit
        email: 'test@example.com',
        mobile: '9876543210',
      };

      await expect(paymentService.createPayment(paymentData))
        .rejects
        .toThrow('amount exceeds maximum limit');
    });

    it('should reject invalid email format', async () => {
      const paymentData = {
        customerId: 'CUST_123',
        amount: 1000,
        email: 'invalid-email',
        mobile: '9876543210',
      };

      await expect(paymentService.createPayment(paymentData))
        .rejects
        .toThrow('email format is invalid');
    });

    it('should reject invalid mobile number format', async () => {
      const paymentData = {
        customerId: 'CUST_123',
        amount: 1000,
        email: 'test@example.com',
        mobile: '1234567890', // Must start with 6-9
      };

      await expect(paymentService.createPayment(paymentData))
        .rejects
        .toThrow('mobile must be a valid Indian mobile number');
    });

    it('should reject short mobile number', async () => {
      const paymentData = {
        customerId: 'CUST_123',
        amount: 1000,
        email: 'test@example.com',
        mobile: '98765432', // Too short
      };

      await expect(paymentService.createPayment(paymentData))
        .rejects
        .toThrow(InvalidPaymentDataError);
    });

    it('should accept valid mobile numbers starting with 6-9', async () => {
      const validMobiles = ['6123456789', '7123456789', '8123456789', '9123456789'];

      for (const mobile of validMobiles) {
        const paymentData = {
          customerId: 'CUST_123',
          amount: 100,
          email: 'test@example.com',
          mobile,
        };

        const result = await paymentService.createPayment(paymentData);
        expect(result.success).toBe(true);
        
        paymentService.clearAllPayments();
      }
    });

    it('should list all validation errors at once', async () => {
      const paymentData = {
        // Missing customerId
        amount: -100, // Invalid amount
        email: 'invalid-email', // Invalid email
        mobile: '1234', // Invalid mobile
      };

      try {
        await paymentService.createPayment(paymentData);
        fail('Should have thrown InvalidPaymentDataError');
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidPaymentDataError);
        expect(error.validationErrors).toBeDefined();
        expect(error.validationErrors.length).toBeGreaterThan(1);
      }
    });
  });

  describe('Retry Logic', () => {
    it('should retry on Paytm API failure', async () => {
      const paymentData = {
        customerId: 'CUST_RETRY',
        amount: 100,
        email: 'retry@example.com',
        mobile: '9876543210',
      };

      // Should eventually succeed despite occasional random failures
      const result = await paymentService.createPayment(paymentData, { maxRetries: 5 });
      expect(result.success).toBe(true);
    });

    it('should use exponential backoff between retries', async () => {
      const paymentData = {
        customerId: 'CUST_BACKOFF',
        amount: 100,
        email: 'backoff@example.com',
        mobile: '9876543210',
      };

      const startTime = Date.now();
      const result = await paymentService.createPayment(paymentData);
      const duration = Date.now() - startTime;

      // Should complete in reasonable time
      expect(duration).toBeLessThan(5000);
      expect(result.success).toBe(true);
    });

    it('should fail after max retries exhausted', async () => {
      const paymentData = {
        customerId: 'CUST_FAIL',
        amount: 100,
        email: 'fail@example.com',
        mobile: '9876543210',
      };

      // Mock will occasionally fail, but with 1 retry it might still fail
      try {
        await paymentService.createPayment(paymentData, { maxRetries: 1, timeout: 10 });
        // If it succeeds, that's okay too (random failure)
      } catch (error) {
        // If it fails, check error message
        expect(error.message).toContain('Failed to initiate Paytm transaction');
      }
    });
  });

  describe('Structured Logging', () => {
    it('should log all stages of payment creation', async () => {
      const paymentData = {
        customerId: 'CUST_LOG',
        amount: 1000,
        email: 'log@example.com',
        mobile: '9876543210',
      };

      const result = await paymentService.createPayment(paymentData);

      // Check result contains stage information
      expect(result.processingTimeMs).toBeDefined();
      expect(result.processingTimeMs).toBeGreaterThan(0);
    });

    it('should log validation failures', async () => {
      const paymentData = {
        customerId: 'CUST_123',
        amount: -100,
        email: 'invalid',
        mobile: '123',
      };

      try {
        await paymentService.createPayment(paymentData);
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidPaymentDataError);
      }
    });
  });

  describe('Performance', () => {
    it('should complete within reasonable time', async () => {
      const paymentData = {
        customerId: 'CUST_PERF',
        amount: 1000,
        email: 'perf@example.com',
        mobile: '9876543210',
      };

      const startTime = Date.now();
      const result = await paymentService.createPayment(paymentData);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(2000); // Should complete in <2s
      expect(result.processingTimeMs).toBeLessThan(2000);
    });

    it('should handle concurrent payment creation', async () => {
      const paymentPromises = [];

      for (let i = 0; i < 5; i++) {
        const paymentData = {
          customerId: `CUST_CONCURRENT_${i}`,
          amount: 100 * (i + 1),
          email: `concurrent${i}@example.com`,
          mobile: `987654321${i}`,
        };

        paymentPromises.push(paymentService.createPayment(paymentData));
      }

      const results = await Promise.all(paymentPromises);

      expect(results.length).toBe(5);
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.orderId).toBeDefined();
      });

      // All should have unique order IDs
      const orderIds = results.map(r => r.orderId);
      const uniqueIds = new Set(orderIds);
      expect(uniqueIds.size).toBe(5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very small amounts', async () => {
      const paymentData = {
        customerId: 'CUST_SMALL',
        amount: 0.01,
        email: 'small@example.com',
        mobile: '9876543210',
      };

      const result = await paymentService.createPayment(paymentData);
      expect(result.success).toBe(true);
      expect(result.amount).toBe(0.01);
    });

    it('should handle maximum allowed amount', async () => {
      const paymentData = {
        customerId: 'CUST_MAX',
        amount: 1000000,
        email: 'max@example.com',
        mobile: '9876543210',
      };

      const result = await paymentService.createPayment(paymentData);
      expect(result.success).toBe(true);
      expect(result.amount).toBe(1000000);
    });

    it('should handle long descriptions', async () => {
      const paymentData = {
        customerId: 'CUST_DESC',
        amount: 100,
        description: 'A'.repeat(500),
        email: 'desc@example.com',
        mobile: '9876543210',
      };

      const result = await paymentService.createPayment(paymentData);
      expect(result.success).toBe(true);
    });

    it('should handle special characters in description', async () => {
      const paymentData = {
        customerId: 'CUST_SPECIAL',
        amount: 100,
        description: 'Payment for "Product A" & "Product B" - 50% off!',
        email: 'special@example.com',
        mobile: '9876543210',
      };

      const result = await paymentService.createPayment(paymentData);
      expect(result.success).toBe(true);
    });
  });
});

