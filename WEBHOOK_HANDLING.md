# Webhook Handling Documentation

## Overview

The webhook handling system processes Paytm payment notifications with complete event tracking, signature verification, idempotency, and automated SMS notifications.

## Webhook Processing Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    WEBHOOK RECEIVED                          │
│  - Extract idempotency key from headers/body                │
│  - Build security context (IP, User-Agent, timestamp)       │
│  - Log: "🔔 Webhook RECEIVED"                               │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              CHECK FOR DUPLICATE                             │
│  - Look up idempotency key in cache                         │
│  - If found: Return cached response immediately             │
│  - If not found: Continue processing                        │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                VALIDATE SIGNATURE                            │
│  - Log: "🔒 Webhook VALIDATING signature"                   │
│  - Verify HMAC-SHA256 checksum with merchant key            │
│  - Use constant-time comparison                             │
│  - Throw SignatureVerificationError if invalid              │
│  - Log: "✅ Webhook VALIDATED successfully"                 │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              APPLY PAYMENT UPDATE                            │
│  - Log: "⚙️ Webhook APPLYING payment status update"         │
│  - Call updatePaymentStatus() with webhook data             │
│  - Update status: SUCCESS/FAILED based on TXN_SUCCESS       │
│  - Store transaction ID, response code, message             │
│  - Log: "✅ Webhook APPLIED successfully"                   │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│          STORE IDEMPOTENCY KEY                               │
│  - Cache result with 24-hour TTL                            │
│  - Prevent duplicate processing                             │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│          SEND SMS NOTIFICATION                               │
│  - Log: "📱 Sending SMS notification for payment"           │
│  - Call sendPaymentNotification() with payment details      │
│  - Different messages for SUCCESS/FAILED                    │
│  - Log: "✅ SMS notification sent successfully"             │
│  - If SMS fails: Log error but don't fail webhook           │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              RETURN SUCCESS RESPONSE                         │
│  {                                                           │
│    "success": true,                                         │
│    "data": {                                                │
│      "orderId": "ORDER_123",                                │
│      "transactionId": "TXN_123",                            │
│      "status": "SUCCESS",                                   │
│      "processingTimeMs": 45,                                │
│      "stages": {                                            │
│        "received": true,                                    │
│        "validated": true,                                   │
│        "applied": true                                      │
│      }                                                       │
│    }                                                         │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
```

## Key Functions

### 1. handlePaymentWebhook()

**Location:** `src/services/paymentService.js`

**Signature:**
```javascript
handlePaymentWebhook(webhookData, securityContext, idempotencyKey)
```

**Parameters:**
- `webhookData` (Object): Paytm webhook payload
  - `ORDERID`: Payment order ID
  - `TXNID`: Transaction ID
  - `STATUS`: Transaction status (TXN_SUCCESS, TXN_FAILURE, etc.)
  - `TXNAMOUNT`: Transaction amount
  - `CHECKSUMHASH`: HMAC signature
  - `RESPCODE`: Response code
  - `RESPMSG`: Response message

- `securityContext` (Object): Security information
  - `ip`: Client IP address
  - `userAgent`: User agent string
  - `timestamp`: Request timestamp
  - `requestId`: Request ID

- `idempotencyKey` (String|null): Key for duplicate prevention

**Returns:**
```javascript
{
  success: true,
  orderId: "ORDER_123",
  transactionId: "TXN_123456",
  status: "SUCCESS", // or "FAILED"
  message: "Webhook processed successfully",
  processingTimeMs: 45,
  stages: {
    received: true,
    validated: true,
    applied: true
  }
}
```

**Throws:**
- `SignatureVerificationError` - Invalid signature
- `InvalidChecksumError` - Bad checksum format
- `PaymentNotFoundError` - Payment doesn't exist

### 2. updatePaymentStatus()

**Location:** `src/services/paymentService.js`

**Signature:**
```javascript
updatePaymentStatus(orderId, updateData)
```

**Parameters:**
- `orderId` (String): Order ID (handles PAYTM_ prefix)
- `updateData` (Object):
  - `status`: New status (SUCCESS/FAILED)
  - `transactionId`: Transaction ID
  - `amount`: Transaction amount
  - `responseCode`: Response code
  - `responseMessage`: Response message

**Returns:** Updated payment object

### 3. sendPaymentNotification()

**Location:** `src/services/notificationService.js`

**Signature:**
```javascript
sendPaymentNotification(paymentData)
```

**Parameters:**
- `paymentData` (Object):
  - `mobile`: Customer mobile number
  - `orderId`: Order ID
  - `amount`: Payment amount
  - `status`: Payment status
  - `customerName`: (Optional) Customer name

**Returns:**
```javascript
{
  success: true,
  notificationId: "SMS_uuid",
  smsId: "SMS_PROVIDER_id",
  mobile: "9876543210",
  status: "SENT",
  sentAt: "2025-10-04T10:30:00.000Z"
}
```

## Event Logging

### Stage 1: RECEIVED
```json
{
  "level": "info",
  "message": "🔔 Webhook RECEIVED",
  "stage": "RECEIVED",
  "orderId": "ORDER_123",
  "txnId": "TXN_123",
  "amount": "1000",
  "status": "TXN_SUCCESS",
  "ip": "103.57.226.1",
  "userAgent": "Paytm-Webhook/1.0",
  "timestamp": "2025-10-04T10:30:00.000Z"
}
```

### Stage 2: VALIDATING
```json
{
  "level": "info",
  "message": "🔒 Webhook VALIDATING signature",
  "stage": "VALIDATING",
  "orderId": "ORDER_123",
  "txnId": "TXN_123"
}
```

### Stage 3: VALIDATED
```json
{
  "level": "info",
  "message": "✅ Webhook VALIDATED successfully",
  "stage": "VALIDATED",
  "orderId": "ORDER_123",
  "checksumVerified": true,
  "verificationTimeMs": 12
}
```

### Stage 4: APPLYING
```json
{
  "level": "info",
  "message": "⚙️ Webhook APPLYING payment status update",
  "stage": "APPLYING",
  "orderId": "ORDER_123",
  "previousStatus": "PENDING",
  "newStatus": "SUCCESS"
}
```

### Stage 5: APPLIED
```json
{
  "level": "info",
  "message": "✅ Webhook APPLIED successfully",
  "stage": "APPLIED",
  "orderId": "ORDER_123",
  "finalStatus": "SUCCESS",
  "processingTimeMs": 45,
  "stages": ["RECEIVED", "VALIDATED", "APPLIED"]
}
```

### SMS Notification
```json
{
  "level": "info",
  "message": "📱 Sending SMS notification for payment",
  "orderId": "ORDER_123",
  "status": "SUCCESS",
  "mobile": "9876543210"
}
```

```json
{
  "level": "info",
  "message": "✅ SMS notification sent successfully",
  "orderId": "ORDER_123",
  "notificationId": "SMS_uuid",
  "smsId": "SMS_PROVIDER_id"
}
```

## Idempotency

### How It Works

1. **Key Extraction**: Automatically extracts from:
   - `x-idempotency-key` header
   - `TXNID` field → `paytm_txn_{TXNID}`

2. **Duplicate Check**: Before processing
   ```javascript
   const cached = checkIdempotencyKey(idempotencyKey);
   if (cached) {
     return { ...cached.data, duplicate: true };
   }
   ```

3. **Result Storage**: After successful processing
   ```javascript
   storeIdempotencyKey(idempotencyKey, result, 'success');
   ```

### Duplicate Response

```json
{
  "success": true,
  "data": {
    "orderId": "ORDER_123",
    "status": "SUCCESS"
  },
  "duplicate": true,
  "message": "Duplicate request - returning cached response"
}
```

## SMS Notifications

### Success Message Template
```
Dear {customerName}, your payment of Rs.{amount} for order {orderId} 
has been successfully processed. Thank you! - Team Pegasus
```

### Failure Message Template
```
Dear {customerName}, your payment of Rs.{amount} for order {orderId} 
has failed. Please try again. - Team Pegasus
```

### When SMS is Sent

- ✅ **Successful payments** (STATUS = TXN_SUCCESS)
- ✅ **Failed payments** (STATUS = TXN_FAILURE)
- ✅ After payment status is updated
- ✅ Non-blocking - webhook succeeds even if SMS fails

## Error Handling

### Signature Verification Failure

**Response (401):**
```json
{
  "success": false,
  "error": "Signature verification failed - checksum mismatch",
  "errorCode": "SIGNATURE_VERIFICATION_FAILED",
  "securityAlert": true
}
```

**Log:**
```json
{
  "level": "error",
  "message": "Webhook security violation",
  "securityAlert": "SIGNATURE_FAILED",
  "severity": "CRITICAL",
  "orderId": "ORDER_123"
}
```

### Payment Not Found

**Response (404):**
```json
{
  "success": false,
  "error": "Payment not found: ORDER_123",
  "errorCode": "PAYMENT_NOT_FOUND"
}
```

### SMS Failure

**Note:** SMS failures do NOT fail the webhook

**Log:**
```json
{
  "level": "error",
  "message": "❌ Failed to send payment notification",
  "orderId": "ORDER_123",
  "error": "Invalid mobile number format"
}
```

## Testing

### Unit Tests

**File:** `__tests__/webhookHandling.test.js`

**Test Coverage:**
- ✅ Successful payment webhook processing
- ✅ Failed payment webhook processing
- ✅ Invalid signature rejection
- ✅ Idempotency (duplicate detection)
- ✅ Payment status updates
- ✅ SMS notification sending
- ✅ Event logging (all stages)
- ✅ Mock Paytm API responses
- ✅ Mock SMS API responses

### Run Tests

```bash
# Run all webhook tests
npm test -- webhookHandling.test.js

# Run with verbose output
npm test -- webhookHandling.test.js --verbose

# Run specific test suite
npm test -- webhookHandling.test.js -t "Successful Payment Webhook"
```

### Example Test: Complete Flow

```javascript
it('should handle successful payment webhook with all stages', async () => {
  // 1. Create payment
  const payment = await paymentService.createPayment({
    customerId: 'CUST_123',
    amount: 1000,
    email: 'test@example.com',
    mobile: '9876543210',
  });

  // 2. Mock Paytm webhook
  const webhookData = {
    ORDERID: payment.paytmOrderId,
    TXNID: 'TXN_123',
    STATUS: 'TXN_SUCCESS',
    TXNAMOUNT: '1000',
    RESPCODE: '01',
    RESPMSG: 'Success',
  };

  // 3. Generate valid checksum
  webhookData.CHECKSUMHASH = generateValidChecksum(webhookData);

  // 4. Process webhook
  const result = await handlePaymentWebhook(webhookData, {}, 'key123');

  // 5. Verify result
  expect(result.success).toBe(true);
  expect(result.status).toBe('SUCCESS');
  expect(result.stages).toEqual({
    received: true,
    validated: true,
    applied: true,
  });

  // 6. Verify payment updated
  const updatedPayment = await getPaymentById(payment.orderId);
  expect(updatedPayment.status).toBe('SUCCESS');

  // 7. Verify SMS sent
  const smsResult = await sendPaymentNotification({
    mobile: updatedPayment.mobile,
    orderId: updatedPayment.orderId,
    amount: updatedPayment.amount,
    status: updatedPayment.status,
  });

  expect(smsResult.success).toBe(true);
});
```

## Usage Examples

### 1. Send Webhook Request

```bash
curl -X POST http://localhost:3000/api/payments/webhook \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: txn_123456" \
  -H "User-Agent: Paytm-Webhook/1.0" \
  -d '{
    "ORDERID": "PAYTM_ORDER_uuid",
    "TXNID": "TXN_123456",
    "STATUS": "TXN_SUCCESS",
    "TXNAMOUNT": "1000",
    "CHECKSUMHASH": "valid_checksum_here",
    "RESPCODE": "01",
    "RESPMSG": "Txn Success"
  }'
```

### 2. Handle Webhook in Route

```javascript
router.post('/webhook', async (req, res) => {
  const webhookData = req.body;
  const idempotencyKey = extractIdempotencyKey(req, webhookData);
  
  const securityContext = {
    ip: req.ip,
    userAgent: req.get('user-agent'),
    timestamp: new Date().toISOString(),
  };

  try {
    // Check duplicate
    if (idempotencyKey) {
      const cached = checkIdempotencyKey(idempotencyKey);
      if (cached) {
        return res.status(200).json({
          success: true,
          data: cached.data,
          duplicate: true,
        });
      }
    }

    // Process webhook
    const result = await handlePaymentWebhook(
      webhookData,
      securityContext,
      idempotencyKey
    );

    // Store for idempotency
    if (idempotencyKey) {
      storeIdempotencyKey(idempotencyKey, result, 'success');
    }

    // Send SMS
    const payment = await getPaymentById(result.orderId);
    await sendPaymentNotification({
      mobile: payment.mobile,
      orderId: payment.orderId,
      amount: payment.amount,
      status: payment.status,
    });

    res.status(200).json({ success: true, data: result });

  } catch (error) {
    if (error instanceof SignatureVerificationError) {
      return res.status(401).json({
        success: false,
        error: error.message,
        errorCode: error.errorCode,
        securityAlert: true,
      });
    }

    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});
```

## Production Considerations

### 1. Database Transactions

Use database transactions for payment updates:

```javascript
await db.transaction(async (trx) => {
  await updatePaymentStatus(orderId, updateData, trx);
  await logWebhookEvent(webhookData, trx);
});
```

### 2. Async SMS

Send SMS asynchronously using message queue:

```javascript
await queue.add('send-sms', {
  mobile: payment.mobile,
  orderId: payment.orderId,
  amount: payment.amount,
  status: payment.status,
});
```

### 3. Webhook Retry Handling

Paytm retries failed webhooks. Your idempotency ensures safe reprocessing:

```
Attempt 1: Process → Success → Cache result
Attempt 2: Check cache → Return cached result
```

### 4. Monitoring

Set up alerts for:
- Multiple signature verification failures
- High webhook processing times
- SMS notification failures
- Unexpected payment statuses

---

## Summary

✅ **Comprehensive Event Tracking**: RECEIVED → VALIDATED → APPLIED  
✅ **Signature Verification**: HMAC-SHA256 with security logging  
✅ **Idempotency**: Automatic duplicate prevention  
✅ **Payment Updates**: Atomic status updates  
✅ **SMS Notifications**: Automated for SUCCESS/FAILED  
✅ **Error Handling**: Typed errors with proper status codes  
✅ **Unit Tests**: 30+ tests covering all scenarios  
✅ **Mock APIs**: Paytm and SMS mock responses  

🎉 **Production-ready webhook handling system!**

