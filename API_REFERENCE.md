# API Quick Reference

## Base URL
```
http://localhost:3000
```

## Health Check

### Check Service Health
```http
GET /health
```

**Response:**
```json
{
  "status": "UP",
  "timestamp": "2025-10-04T10:30:00.000Z",
  "uptime": 123.45,
  "environment": "development",
  "service": "payments-notifications-service"
}
```

---

## Payment APIs

### 1. Create Payment
```http
POST /api/payments/create
Content-Type: application/json

{
  "customerId": "CUST_123",
  "amount": 1000,
  "currency": "INR",
  "description": "Product purchase",
  "email": "customer@example.com",
  "mobile": "9876543210"
}
```

**Success Response:**
```json
{
  "success": true,
  "data": {
    "orderId": "ORDER_uuid",
    "paytmOrderId": "PAYTM_ORDER_uuid",
    "txnToken": "TXN_TOKEN_...",
    "amount": 1000,
    "currency": "INR",
    "status": "PENDING"
  }
}
```

### 2. Get Payment by ID
```http
GET /api/payments/:orderId
```

**Success Response:**
```json
{
  "success": true,
  "data": {
    "orderId": "ORDER_uuid",
    "customerId": "CUST_123",
    "amount": 1000,
    "currency": "INR",
    "status": "PENDING",
    "transactionId": null,
    "createdAt": "2025-10-04T10:30:00.000Z",
    "updatedAt": "2025-10-04T10:30:00.000Z"
  }
}
```

### 3. Update Payment Status
```http
PUT /api/payments/:orderId/status
Content-Type: application/json

{
  "status": "SUCCESS",
  "transactionId": "TXN_123456",
  "responseCode": "01",
  "responseMessage": "Transaction Successful"
}
```

### 4. Payment Webhook (Paytm Callback)
```http
POST /api/payments/webhook
Content-Type: application/json

{
  "ORDERID": "PAYTM_ORDER_uuid",
  "TXNID": "TXN_123456",
  "STATUS": "TXN_SUCCESS",
  "TXNAMOUNT": "1000",
  "CHECKSUMHASH": "checksum_value",
  "RESPCODE": "01",
  "RESPMSG": "Transaction Successful"
}
```

### 5. Get All Payments
```http
GET /api/payments
```

**Success Response:**
```json
{
  "success": true,
  "data": [...],
  "count": 10
}
```

---

## Notification APIs

### 1. Send SMS Notification
```http
POST /api/notifications/sms
Content-Type: application/json

{
  "mobile": "9876543210",
  "message": "Your custom SMS message",
  "templateId": "TEMPLATE_ID"
}
```

**Success Response:**
```json
{
  "success": true,
  "data": {
    "notificationId": "SMS_uuid",
    "smsId": "SMS_PROVIDER_id",
    "mobile": "9876543210",
    "status": "SENT",
    "sentAt": "2025-10-04T10:30:00.000Z"
  }
}
```

### 2. Send Payment Notification
```http
POST /api/notifications/payment
Content-Type: application/json

{
  "mobile": "9876543210",
  "orderId": "ORDER_123",
  "amount": 1000,
  "status": "SUCCESS",
  "customerName": "John Doe"
}
```

**SMS Templates by Status:**
- **SUCCESS**: "Dear {name}, your payment of Rs.{amount} for order {orderId} has been successfully processed. Thank you! - Team Pegasus"
- **FAILED**: "Dear {name}, your payment of Rs.{amount} for order {orderId} has failed. Please try again. - Team Pegasus"
- **PENDING**: "Dear {name}, your payment of Rs.{amount} for order {orderId} is being processed. - Team Pegasus"

### 3. Get Notification by ID
```http
GET /api/notifications/:notificationId
```

**Success Response:**
```json
{
  "success": true,
  "data": {
    "notificationId": "SMS_uuid",
    "type": "SMS",
    "mobile": "9876543210",
    "message": "Your SMS content",
    "status": "SENT",
    "createdAt": "2025-10-04T10:30:00.000Z",
    "sentAt": "2025-10-04T10:30:05.000Z"
  }
}
```

### 4. Get All Notifications
```http
GET /api/notifications
```

**Success Response:**
```json
{
  "success": true,
  "data": [...],
  "count": 15
}
```

---

## Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `201` - Created (for new resources)
- `400` - Bad Request (validation errors)
- `404` - Not Found
- `500` - Internal Server Error

---

## cURL Examples

### Create Payment
```bash
curl -X POST http://localhost:3000/api/payments/create \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "CUST_123",
    "amount": 1000,
    "email": "test@example.com",
    "mobile": "9876543210"
  }'
```

### Get Payment
```bash
curl http://localhost:3000/api/payments/ORDER_abc123
```

### Send SMS
```bash
curl -X POST http://localhost:3000/api/notifications/sms \
  -H "Content-Type: application/json" \
  -d '{
    "mobile": "9876543210",
    "message": "Hello from Pegasus!"
  }'
```

### Health Check
```bash
curl http://localhost:3000/health
```

---

## Service Functions (Internal Use)

### Payment Service
- `createPayment(paymentData)` - Create new payment
- `getPaymentById(orderId)` - Get payment details
- `updatePaymentStatus(orderId, updateData)` - Update payment
- `verifyPaytmSignature(params, checksum)` - Verify Paytm checksum
- `handlePaymentWebhook(webhookData)` - Process webhook

### Notification Service
- `sendSMSNotification(smsData)` - Send SMS
- `sendPaymentNotification(paymentData)` - Send payment SMS
- `getNotificationById(notificationId)` - Get notification details

---

## Mobile Number Format

Valid Indian mobile number format:
- Must start with 6, 7, 8, or 9
- Must be exactly 10 digits
- Example: `9876543210`

## Payment Status Values

- `PENDING` - Payment initiated
- `SUCCESS` - Payment successful
- `FAILED` - Payment failed
- `PROCESSING` - Payment being processed

## Notification Status Values

- `PENDING` - Notification queued
- `SENT` - Notification sent
- `DELIVERED` - Notification delivered
- `FAILED` - Notification failed

