# Security Features Documentation

## Enhanced Paytm Signature Verification

The system includes robust signature verification with comprehensive security logging and typed error handling.

### Features

#### 1. **HMAC-SHA256 Signature Verification**

The `verifyPaytmSignature()` function validates webhook payloads using HMAC-SHA256:

```javascript
const isValid = verifyPaytmSignature(params, checksum, securityContext);
```

**Parameters:**
- `params` (Object): Payment response parameters from Paytm
- `checksum` (String): HMAC checksum to verify
- `securityContext` (Object): Optional security context (IP, user agent, etc.)

**Returns:** `true` if signature is valid

**Throws:**
- `SignatureVerificationError`: When signature verification fails
- `InvalidChecksumError`: When checksum format is invalid

#### 2. **Security Context Logging**

All verification attempts are logged with comprehensive security context:

```javascript
const securityContext = {
  ip: '192.168.1.1',
  userAgent: 'Mozilla/5.0',
  requestId: 'REQ_123',
  timestamp: '2025-10-04T10:30:00.000Z'
};

verifyPaytmSignature(params, checksum, securityContext);
```

**Logged Information:**
- Order ID and Transaction ID
- Amount and status
- IP address and User Agent
- Request ID and timestamp
- Verification time in milliseconds
- Security alert level (HIGH/CRITICAL)

#### 3. **Typed Errors**

Custom error classes provide structured error handling:

##### SignatureVerificationError
```javascript
{
  name: 'SignatureVerificationError',
  errorCode: 'SIGNATURE_VERIFICATION_FAILED',
  statusCode: 401,
  message: 'Signature verification failed - checksum mismatch',
  details: {
    orderId: 'ORDER_123',
    txnId: 'TXN_123',
    reason: 'CHECKSUM_MISMATCH',
    verificationTimeMs: 15
  }
}
```

##### InvalidChecksumError
```javascript
{
  name: 'InvalidChecksumError',
  errorCode: 'INVALID_CHECKSUM',
  statusCode: 401,
  message: 'Checksum must be a valid hex string',
  details: { ... }
}
```

##### Other Error Types
- `PaymentNotFoundError` - Payment record not found
- `InvalidPaymentDataError` - Invalid payment input data
- `WebhookValidationError` - Webhook validation failed
- `DuplicateWebhookError` - Duplicate webhook detected

#### 4. **Constant-Time Comparison**

Uses `crypto.timingSafeEqual()` to prevent timing attacks:

```javascript
const isValid = crypto.timingSafeEqual(
  Buffer.from(generatedChecksum, 'hex'),
  Buffer.from(checksum, 'hex')
);
```

#### 5. **Input Validation**

Comprehensive validation of inputs:

- **Parameters**: Must be a non-empty object
- **Checksum**: Must be a non-empty hex string
- **Merchant Key**: Must be configured
- **Parameter Filtering**: Removes null/undefined values

#### 6. **Security Logging Levels**

**SUCCESS (INFO level):**
```json
{
  "level": "info",
  "message": "Paytm signature verification SUCCESSFUL",
  "orderId": "ORDER_123",
  "txnId": "TXN_123",
  "verificationTimeMs": 12,
  "securityLevel": "high"
}
```

**FAILURE (ERROR level):**
```json
{
  "level": "error",
  "message": "Paytm signature verification FAILED",
  "orderId": "ORDER_123",
  "securityAlert": "SIGNATURE_MISMATCH",
  "severity": "HIGH",
  "expectedChecksumSample": "abcdef1234...",
  "providedChecksumSample": "123456abcd..."
}
```

---

## Idempotency Key Management

Prevents duplicate webhook processing and ensures exactly-once execution.

### Features

#### 1. **Automatic Idempotency Key Extraction**

Extracts idempotency keys from multiple sources:

```javascript
const idempotencyKey = extractIdempotencyKey(req, body);
```

**Extraction Priority (highest to lowest):**
1. `x-idempotency-key` header
2. `idempotency-key` header
3. `x-request-id` header
4. `request-id` header
5. `idempotencyKey` in body
6. `requestId` in body
7. `TXNID` in body (for Paytm webhooks)

#### 2. **Duplicate Detection**

Automatically detects and handles duplicate requests:

```javascript
const cached = checkIdempotencyKey(key);
if (cached) {
  // Return cached response
  return res.status(200).json({
    success: true,
    data: cached.data,
    duplicate: true,
    message: 'Duplicate request - returning cached response'
  });
}
```

#### 3. **Response Caching**

Stores responses for 24 hours:

```javascript
storeIdempotencyKey(key, result, 'success');
```

**Stored Data:**
```javascript
{
  timestamp: 1696420200000,
  data: { orderId: 'ORDER_123', status: 'SUCCESS' },
  status: 'success' // or 'failed'
}
```

#### 4. **Automatic Cleanup**

Expired keys are automatically cleaned up every hour.

**TTL:** 24 hours (configurable)

#### 5. **Logging**

All idempotency operations are logged:

```json
{
  "level": "info",
  "message": "Duplicate webhook detected, returning cached response",
  "idempotencyKey": "paytm_txn_TXN_123456",
  "orderId": "ORDER_123",
  "cachedStatus": "success"
}
```

---

## Webhook Security Implementation

### Request Flow

```
1. Webhook Request Received
   ↓
2. Extract Idempotency Key
   ↓
3. Check for Duplicate (return cached if found)
   ↓
4. Build Security Context (IP, User-Agent, etc.)
   ↓
5. Verify Signature with HMAC-SHA256
   ↓
6. Process Payment Update
   ↓
7. Store Idempotency Key
   ↓
8. Send Notification
   ↓
9. Return Response
```

### Example: Webhook Handler

```javascript
router.post('/webhook', async (req, res) => {
  const webhookData = req.body;
  
  // Extract idempotency key
  const idempotencyKey = extractIdempotencyKey(req, webhookData);
  
  // Build security context
  const securityContext = {
    ip: req.ip,
    userAgent: req.get('user-agent'),
    timestamp: new Date().toISOString(),
  };

  try {
    // Check for duplicate
    if (idempotencyKey) {
      const cached = checkIdempotencyKey(idempotencyKey);
      if (cached) {
        return res.status(200).json({
          success: true,
          data: cached.data,
          duplicate: true
        });
      }
    }

    // Verify signature
    const result = await handlePaymentWebhook(
      webhookData, 
      securityContext, 
      idempotencyKey
    );
    
    // Store for idempotency
    if (idempotencyKey) {
      storeIdempotencyKey(idempotencyKey, result, 'success');
    }

    res.status(200).json({ success: true, data: result });
    
  } catch (error) {
    // Handle typed errors
    if (error instanceof SignatureVerificationError) {
      return res.status(401).json({
        success: false,
        error: error.message,
        errorCode: error.errorCode,
        securityAlert: true
      });
    }
    
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});
```

---

## Usage Examples

### 1. **Sending a Webhook with Idempotency Key**

```bash
curl -X POST http://localhost:3000/api/payments/webhook \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: unique-key-123" \
  -d '{
    "ORDERID": "ORDER_123",
    "TXNID": "TXN_123456",
    "STATUS": "TXN_SUCCESS",
    "TXNAMOUNT": "1000",
    "CHECKSUMHASH": "valid_checksum_here",
    "RESPCODE": "01",
    "RESPMSG": "Transaction Successful"
  }'
```

### 2. **Handling Signature Verification Errors**

```javascript
try {
  verifyPaytmSignature(params, checksum, securityContext);
} catch (error) {
  if (error instanceof SignatureVerificationError) {
    console.error('Security violation detected!');
    console.error('Order ID:', error.details.orderId);
    console.error('Reason:', error.details.reason);
    // Trigger security alert
  }
}
```

### 3. **Testing Signature Verification**

```javascript
const crypto = require('crypto');

// Generate valid checksum
const params = {
  ORDERID: 'ORDER_123',
  TXNID: 'TXN_123',
  TXNAMOUNT: '1000',
  STATUS: 'TXN_SUCCESS'
};

const merchantKey = process.env.PAYTM_MERCHANT_KEY;
const paramString = Object.keys(params)
  .sort()
  .map(key => `${key}=${params[key]}`)
  .join('|');

const checksum = crypto
  .createHmac('sha256', merchantKey)
  .update(paramString, 'utf8')
  .digest('hex');

// Verify
const isValid = verifyPaytmSignature(params, checksum);
```

---

## Security Best Practices

### 1. **Always Use HTTPS in Production**
```javascript
// config.js
paytm: {
  callbackUrl: 'https://yourdomain.com/api/payments/webhook'
}
```

### 2. **Rotate Secrets Regularly**
Update `PAYTM_MERCHANT_KEY` periodically and maintain version tracking.

### 3. **Monitor Security Logs**
Set up alerts for:
- Multiple signature verification failures
- Suspicious IP addresses
- High verification times

### 4. **Rate Limiting**
Add rate limiting to webhook endpoints:
```javascript
const rateLimit = require('express-rate-limit');

const webhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/payments/webhook', webhookLimiter);
```

### 5. **IP Whitelisting**
Only accept webhooks from Paytm's IP ranges:
```javascript
const PAYTM_IPS = ['103.xx.xx.xx', '115.xx.xx.xx'];

const ipWhitelist = (req, res, next) => {
  const clientIp = req.ip;
  if (!PAYTM_IPS.includes(clientIp)) {
    logger.error('Webhook from unauthorized IP', { ip: clientIp });
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

app.use('/api/payments/webhook', ipWhitelist);
```

---

## Error Response Examples

### Signature Verification Failed
```json
{
  "success": false,
  "error": "Signature verification failed - checksum mismatch",
  "errorCode": "SIGNATURE_VERIFICATION_FAILED",
  "securityAlert": true
}
```

### Invalid Checksum Format
```json
{
  "success": false,
  "error": "Checksum must be a valid hex string",
  "errorCode": "INVALID_CHECKSUM"
}
```

### Duplicate Webhook
```json
{
  "success": true,
  "data": { "orderId": "ORDER_123", "status": "SUCCESS" },
  "duplicate": true,
  "message": "Duplicate request - returning cached response"
}
```

---

## Production Considerations

### 1. **Use Redis for Idempotency Store**
Replace in-memory Map with Redis for distributed systems:

```javascript
const redis = require('redis');
const client = redis.createClient();

const storeIdempotencyKey = async (key, data, status) => {
  const record = { timestamp: Date.now(), data, status };
  await client.setex(key, 86400, JSON.stringify(record)); // 24 hour TTL
};
```

### 2. **Database Logging**
Store security events in database for audit trail:

```javascript
await SecurityEvent.create({
  type: 'SIGNATURE_VERIFICATION_FAILED',
  orderId: params.ORDERID,
  ip: securityContext.ip,
  severity: 'HIGH',
  timestamp: new Date()
});
```

### 3. **Alerting Integration**
Integrate with monitoring services (Sentry, DataDog, etc.):

```javascript
if (error instanceof SignatureVerificationError) {
  Sentry.captureException(error, {
    level: 'critical',
    tags: { orderId: error.details.orderId }
  });
}
```

---

## Testing

Run the comprehensive test suite:

```bash
# Run all tests
npm test

# Run only signature verification tests
npm test -- signatureVerification.test.js

# Run only idempotency tests
npm test -- idempotency.test.js

# Run with coverage
npm test -- --coverage
```

**Test Coverage:**
- ✅ Valid signature verification
- ✅ Invalid signature detection
- ✅ Typed error handling
- ✅ Security context logging
- ✅ Idempotency key extraction
- ✅ Duplicate detection
- ✅ Response caching
- ✅ Parameter validation
- ✅ Timing attack prevention

---

For more information, see:
- `src/errors/PaymentErrors.js` - Error class definitions
- `src/utils/idempotency.js` - Idempotency utilities
- `src/services/paymentService.js` - Signature verification implementation
- `__tests__/signatureVerification.test.js` - Verification tests
- `__tests__/idempotency.test.js` - Idempotency tests

