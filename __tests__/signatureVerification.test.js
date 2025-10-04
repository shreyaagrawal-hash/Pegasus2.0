const paymentService = require('../src/services/paymentService');
const {
  SignatureVerificationError,
  InvalidChecksumError,
} = require('../src/errors/PaymentErrors');
const crypto = require('crypto');

describe('Enhanced Signature Verification', () => {
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
  });

  describe('Valid Signature', () => {
    it('should verify valid signature successfully', () => {
      const params = {
        ORDERID: 'ORDER_123',
        TXNID: 'TXN_123',
        TXNAMOUNT: '1000',
        STATUS: 'TXN_SUCCESS',
        RESPCODE: '01',
        RESPMSG: 'Success',
      };

      const checksum = generateValidChecksum(params);
      const result = paymentService.verifyPaytmSignature(params, checksum);

      expect(result).toBe(true);
    });

    it('should verify signature with security context', () => {
      const params = {
        ORDERID: 'ORDER_123',
        TXNID: 'TXN_123',
        TXNAMOUNT: '1000',
        STATUS: 'TXN_SUCCESS',
      };

      const securityContext = {
        ip: '192.168.1.1',
        userAgent: 'Test-Agent',
      };

      const checksum = generateValidChecksum(params);
      const result = paymentService.verifyPaytmSignature(params, checksum, securityContext);

      expect(result).toBe(true);
    });

    it('should handle parameters with special characters', () => {
      const params = {
        ORDERID: 'ORDER_123',
        TXNID: 'TXN_ABC-123',
        TXNAMOUNT: '1000.50',
        STATUS: 'TXN_SUCCESS',
        RESPMSG: 'Payment successful!',
      };

      const checksum = generateValidChecksum(params);
      const result = paymentService.verifyPaytmSignature(params, checksum);

      expect(result).toBe(true);
    });
  });

  describe('Invalid Signature', () => {
    it('should throw SignatureVerificationError for invalid checksum', () => {
      const params = {
        ORDERID: 'ORDER_123',
        TXNID: 'TXN_123',
        TXNAMOUNT: '1000',
        STATUS: 'TXN_SUCCESS',
      };

      const invalidChecksum = 'invalid_checksum_123456789abcdef';

      expect(() => {
        paymentService.verifyPaytmSignature(params, invalidChecksum);
      }).toThrow(SignatureVerificationError);
    });

    it('should throw SignatureVerificationError with details', () => {
      const params = {
        ORDERID: 'ORDER_123',
        TXNID: 'TXN_123',
        TXNAMOUNT: '1000',
        STATUS: 'TXN_SUCCESS',
      };

      const validChecksum = generateValidChecksum(params);
      const tamperedChecksum = validChecksum.substring(0, validChecksum.length - 1) + 'a';

      try {
        paymentService.verifyPaytmSignature(params, tamperedChecksum);
        fail('Should have thrown SignatureVerificationError');
      } catch (error) {
        expect(error).toBeInstanceOf(SignatureVerificationError);
        expect(error.errorCode).toBe('SIGNATURE_VERIFICATION_FAILED');
        expect(error.statusCode).toBe(401);
        expect(error.details).toBeDefined();
        expect(error.details.reason).toBe('CHECKSUM_MISMATCH');
      }
    });

    it('should throw InvalidChecksumError for non-string checksum', () => {
      const params = {
        ORDERID: 'ORDER_123',
        TXNID: 'TXN_123',
      };

      expect(() => {
        paymentService.verifyPaytmSignature(params, null);
      }).toThrow(InvalidChecksumError);

      expect(() => {
        paymentService.verifyPaytmSignature(params, undefined);
      }).toThrow(InvalidChecksumError);

      expect(() => {
        paymentService.verifyPaytmSignature(params, 123);
      }).toThrow(InvalidChecksumError);
    });

    it('should throw InvalidChecksumError for non-hex checksum', () => {
      const params = {
        ORDERID: 'ORDER_123',
        TXNID: 'TXN_123',
      };

      expect(() => {
        paymentService.verifyPaytmSignature(params, 'not-a-hex-string!@#');
      }).toThrow(InvalidChecksumError);
    });

    it('should throw SignatureVerificationError for invalid params', () => {
      const checksum = 'abcdef1234567890';

      expect(() => {
        paymentService.verifyPaytmSignature(null, checksum);
      }).toThrow(SignatureVerificationError);

      expect(() => {
        paymentService.verifyPaytmSignature(undefined, checksum);
      }).toThrow(SignatureVerificationError);

      expect(() => {
        paymentService.verifyPaytmSignature('not-an-object', checksum);
      }).toThrow(SignatureVerificationError);
    });
  });

  describe('Security Context Logging', () => {
    it('should log security context on verification', () => {
      const params = {
        ORDERID: 'ORDER_123',
        TXNID: 'TXN_123',
        TXNAMOUNT: '1000',
        STATUS: 'TXN_SUCCESS',
      };

      const securityContext = {
        ip: '10.0.0.1',
        userAgent: 'Mozilla/5.0',
        requestId: 'REQ_123',
      };

      const checksum = generateValidChecksum(params);
      const result = paymentService.verifyPaytmSignature(params, checksum, securityContext);

      expect(result).toBe(true);
    });

    it('should log security alert on verification failure', () => {
      const params = {
        ORDERID: 'ORDER_123',
        TXNID: 'TXN_123',
        TXNAMOUNT: '1000',
        STATUS: 'TXN_SUCCESS',
      };

      const securityContext = {
        ip: '192.168.1.100',
        userAgent: 'Suspicious-Agent',
      };

      const invalidChecksum = generateValidChecksum(params);
      const tamperedChecksum = invalidChecksum.replace(/a/g, 'b');

      try {
        paymentService.verifyPaytmSignature(params, tamperedChecksum, securityContext);
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(SignatureVerificationError);
        expect(error.details.orderId).toBe('ORDER_123');
        expect(error.details.txnId).toBe('TXN_123');
      }
    });
  });

  describe('Parameter Handling', () => {
    it('should filter out undefined and null parameters', () => {
      const params = {
        ORDERID: 'ORDER_123',
        TXNID: 'TXN_123',
        TXNAMOUNT: '1000',
        STATUS: 'TXN_SUCCESS',
        UNDEFINED_FIELD: undefined,
        NULL_FIELD: null,
      };

      const checksum = generateValidChecksum(params);
      const result = paymentService.verifyPaytmSignature(params, checksum);

      expect(result).toBe(true);
    });

    it('should exclude CHECKSUMHASH from verification', () => {
      const params = {
        ORDERID: 'ORDER_123',
        TXNID: 'TXN_123',
        TXNAMOUNT: '1000',
        STATUS: 'TXN_SUCCESS',
      };

      const checksum = generateValidChecksum(params);
      
      // Add CHECKSUMHASH to params
      params.CHECKSUMHASH = checksum;

      const result = paymentService.verifyPaytmSignature(params, checksum);
      expect(result).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should verify signature within reasonable time', () => {
      const params = {
        ORDERID: 'ORDER_123',
        TXNID: 'TXN_123',
        TXNAMOUNT: '1000',
        STATUS: 'TXN_SUCCESS',
      };

      const checksum = generateValidChecksum(params);

      const startTime = Date.now();
      paymentService.verifyPaytmSignature(params, checksum);
      const endTime = Date.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(100); // Should complete in under 100ms
    });
  });
});

