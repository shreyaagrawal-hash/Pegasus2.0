const logger = require('./logger');

/**
 * In-memory store for idempotency keys (use Redis in production)
 * Structure: { key: { timestamp, data, status } }
 */
const idempotencyStore = new Map();

/**
 * Idempotency key TTL in milliseconds (24 hours)
 */
const IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000;

/**
 * Extract idempotency key from request headers or body
 * @param {Object} req - Express request object
 * @param {Object} body - Request body
 * @returns {String|null} Idempotency key or null
 */
const extractIdempotencyKey = (req, body = {}) => {
  // Check common header names (following industry standards)
  const headerKey = req.get('x-idempotency-key') || 
                    req.get('idempotency-key') ||
                    req.get('x-request-id') ||
                    req.get('request-id');
  
  if (headerKey) {
    logger.debug('Idempotency key extracted from header', { key: headerKey });
    return headerKey;
  }

  // Check body for idempotency key
  const bodyKey = body.idempotencyKey || 
                  body.idempotency_key ||
                  body.requestId ||
                  body.request_id;

  if (bodyKey) {
    logger.debug('Idempotency key extracted from body', { key: bodyKey });
    return bodyKey;
  }

  // For Paytm webhooks, use TXNID as idempotency key
  if (body.TXNID) {
    logger.debug('Using TXNID as idempotency key', { key: body.TXNID });
    return `paytm_txn_${body.TXNID}`;
  }

  logger.debug('No idempotency key found in request');
  return null;
};

/**
 * Check if idempotency key has been processed
 * @param {String} key - Idempotency key
 * @returns {Object|null} Previous response or null if not found
 */
const checkIdempotencyKey = (key) => {
  if (!key) return null;

  const stored = idempotencyStore.get(key);
  
  if (!stored) {
    logger.debug('Idempotency key not found in store', { key });
    return null;
  }

  // Check if key has expired
  const now = Date.now();
  if (now - stored.timestamp > IDEMPOTENCY_TTL) {
    logger.info('Idempotency key expired, removing', { 
      key, 
      age: now - stored.timestamp 
    });
    idempotencyStore.delete(key);
    return null;
  }

  logger.info('Duplicate request detected via idempotency key', {
    key,
    originalTimestamp: new Date(stored.timestamp).toISOString(),
    status: stored.status,
  });

  return stored;
};

/**
 * Store idempotency key with response data
 * @param {String} key - Idempotency key
 * @param {Object} data - Response data
 * @param {String} status - Status (success/failed)
 */
const storeIdempotencyKey = (key, data, status = 'success') => {
  if (!key) return;

  const record = {
    timestamp: Date.now(),
    data,
    status,
  };

  idempotencyStore.set(key, record);

  logger.debug('Idempotency key stored', { 
    key, 
    status,
    dataKeys: Object.keys(data),
  });
};

/**
 * Clear expired idempotency keys (cleanup job)
 */
const cleanupExpiredKeys = () => {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, value] of idempotencyStore.entries()) {
    if (now - value.timestamp > IDEMPOTENCY_TTL) {
      idempotencyStore.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.info('Cleaned up expired idempotency keys', { count: cleaned });
  }
};

/**
 * Clear all idempotency keys (for testing)
 */
const clearAllIdempotencyKeys = () => {
  idempotencyStore.clear();
  logger.debug('All idempotency keys cleared');
};

/**
 * Get all idempotency keys (for testing)
 */
const getAllIdempotencyKeys = () => {
  return Array.from(idempotencyStore.entries()).map(([key, value]) => ({
    key,
    ...value,
  }));
};

// Run cleanup every hour
setInterval(cleanupExpiredKeys, 60 * 60 * 1000);

module.exports = {
  extractIdempotencyKey,
  checkIdempotencyKey,
  storeIdempotencyKey,
  cleanupExpiredKeys,
  clearAllIdempotencyKeys,
  getAllIdempotencyKeys,
};

