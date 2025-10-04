/**
 * Custom error classes for payment operations
 */

class PaymentError extends Error {
  constructor(message, statusCode = 500, errorCode = 'PAYMENT_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

class SignatureVerificationError extends PaymentError {
  constructor(message = 'Signature verification failed', details = {}) {
    super(message, 401, 'SIGNATURE_VERIFICATION_FAILED');
    this.details = details;
  }
}

class InvalidChecksumError extends PaymentError {
  constructor(message = 'Invalid checksum provided', details = {}) {
    super(message, 401, 'INVALID_CHECKSUM');
    this.details = details;
  }
}

class WebhookValidationError extends PaymentError {
  constructor(message = 'Webhook validation failed', details = {}) {
    super(message, 400, 'WEBHOOK_VALIDATION_FAILED');
    this.details = details;
  }
}

class DuplicateWebhookError extends PaymentError {
  constructor(message = 'Duplicate webhook request detected', idempotencyKey) {
    super(message, 409, 'DUPLICATE_WEBHOOK');
    this.idempotencyKey = idempotencyKey;
  }
}

class PaymentNotFoundError extends PaymentError {
  constructor(orderId) {
    super(`Payment not found: ${orderId}`, 404, 'PAYMENT_NOT_FOUND');
    this.orderId = orderId;
  }
}

class InvalidPaymentDataError extends PaymentError {
  constructor(message = 'Invalid payment data', validationErrors = []) {
    super(message, 400, 'INVALID_PAYMENT_DATA');
    this.validationErrors = validationErrors;
  }
}

module.exports = {
  PaymentError,
  SignatureVerificationError,
  InvalidChecksumError,
  WebhookValidationError,
  DuplicateWebhookError,
  PaymentNotFoundError,
  InvalidPaymentDataError,
};

