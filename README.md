# Pegasus Payments & Notifications Service

A robust Node.js Express service for handling payments via Paytm and SMS notifications with structured logging and comprehensive testing.

## Features

- 🔐 **Payment Integration**: Paytm payment gateway integration with webhook handling
- 🔒 **Enhanced Security**: HMAC-SHA256 signature verification with typed errors
- 🔑 **Idempotency**: Duplicate webhook prevention with automatic key extraction
- 📱 **SMS Notifications**: SMS notification service for payment updates
- 🏥 **Health Monitoring**: Health check endpoint for service monitoring
- 📊 **Structured Logging**: Winston-based logging with comprehensive security context
- ⚙️ **Environment-driven Configuration**: Secure config management with .env
- 🛡️ **Security**: Helmet.js, constant-time comparison, typed error handling
- ✅ **Comprehensive Testing**: Full test coverage with Jest and Supertest (90+ tests)
- 🎭 **Mock Integration**: Mock APIs for development and testing

## Project Structure

```
Pegasus2.0/
├── src/
│   ├── config/
│   │   └── config.js              # Environment configuration
│   ├── errors/
│   │   └── PaymentErrors.js       # Custom typed error classes
│   ├── routes/
│   │   ├── paymentRoutes.js       # Payment API routes with idempotency
│   │   └── notificationRoutes.js  # Notification API routes
│   ├── services/
│   │   ├── paymentService.js      # Payment business logic
│   │   └── notificationService.js # Notification business logic
│   ├── utils/
│   │   ├── logger.js              # Structured logging utility
│   │   └── idempotency.js         # Idempotency key management
│   └── server.js                  # Express server setup
├── __tests__/
│   ├── paymentService.test.js     # Payment service tests
│   ├── notificationService.test.js # Notification service tests
│   ├── signatureVerification.test.js # Signature verification tests
│   ├── idempotency.test.js        # Idempotency tests
│   └── api.test.js                # API integration tests
├── logs/                          # Log files (auto-generated)
├── .env.example                   # Environment variables template
├── SECURITY_FEATURES.md           # Security documentation
├── package.json
└── README.md
```

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn

## Installation

1. **Clone the repository**
   ```bash
   cd Pegasus2.0
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory:
   ```bash
   # Copy from example
   cp .env.example .env
   ```

   Edit `.env` with your actual credentials:
   ```env
   PORT=3000
   NODE_ENV=development

   # Paytm Configuration
   PAYTM_MERCHANT_ID=your_merchant_id
   PAYTM_MERCHANT_KEY=your_merchant_key
   PAYTM_WEBSITE=WEBSTAGING
   PAYTM_INDUSTRY_TYPE=Retail
   PAYTM_CHANNEL_ID=WEB
   PAYTM_CALLBACK_URL=http://localhost:3000/api/payments/callback

   # SMS Configuration
   SMS_API_KEY=your_sms_api_key
   SMS_API_SECRET=your_sms_api_secret
   SMS_SENDER_ID=PEGASUS
   SMS_API_URL=https://api.sms-provider.com/send

   # Application Secrets
   APP_SECRET=your_app_secret
   JWT_SECRET=your_jwt_secret

   # Logging
   LOG_LEVEL=info
   ```

## Usage

### Start the Server

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will start on `http://localhost:3000` (or your configured PORT).

### Run Tests

**Run all tests:**
```bash
npm test
```

**Run tests in watch mode:**
```bash
npm run test:watch
```

## API Documentation

### Health Check

**GET /health**

Check service health status.

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

### Payment APIs

#### Create Payment

**POST /api/payments/create**

Create a new payment transaction.

**Request Body:**
```json
{
  "customerId": "CUST_123",
  "amount": 1000,
  "currency": "INR",
  "description": "Product purchase",
  "email": "customer@example.com",
  "mobile": "9876543210"
}
```

**Response:**
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

#### Get Payment

**GET /api/payments/:orderId**

Retrieve payment details by order ID.

**Response:**
```json
{
  "success": true,
  "data": {
    "orderId": "ORDER_uuid",
    "customerId": "CUST_123",
    "amount": 1000,
    "currency": "INR",
    "status": "SUCCESS",
    "transactionId": "TXN_123456",
    "createdAt": "2025-10-04T10:30:00.000Z",
    "updatedAt": "2025-10-04T10:31:00.000Z"
  }
}
```

#### Update Payment Status

**PUT /api/payments/:orderId/status**

Update payment status.

**Request Body:**
```json
{
  "status": "SUCCESS",
  "transactionId": "TXN_123456",
  "responseCode": "01",
  "responseMessage": "Transaction Successful"
}
```

#### Payment Webhook

**POST /api/payments/webhook**

Handle Paytm payment webhooks.

**Request Body:**
```json
{
  "ORDERID": "ORDER_uuid",
  "TXNID": "TXN_123456",
  "STATUS": "TXN_SUCCESS",
  "TXNAMOUNT": "1000",
  "CHECKSUMHASH": "checksum_value",
  "RESPCODE": "01",
  "RESPMSG": "Transaction Successful"
}
```

#### Get All Payments

**GET /api/payments**

Retrieve all payments (for testing purposes).

### Notification APIs

#### Send SMS

**POST /api/notifications/sms**

Send an SMS notification.

**Request Body:**
```json
{
  "mobile": "9876543210",
  "message": "Your custom SMS message",
  "templateId": "TEMPLATE_ID"
}
```

**Response:**
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

#### Send Payment Notification

**POST /api/notifications/payment**

Send payment status notification SMS.

**Request Body:**
```json
{
  "mobile": "9876543210",
  "orderId": "ORDER_123",
  "amount": 1000,
  "status": "SUCCESS",
  "customerName": "John Doe"
}
```

#### Get Notification

**GET /api/notifications/:notificationId**

Retrieve notification details.

#### Get All Notifications

**GET /api/notifications**

Retrieve all notifications (for testing purposes).

## Service Functions

### Payment Service

- `createPayment(paymentData)` - Create a new payment
- `verifyPaytmSignature(params, checksum, securityContext)` - **Enhanced** HMAC-SHA256 signature verification with security logging
- `handlePaymentWebhook(webhookData, securityContext, idempotencyKey)` - **Enhanced** Process payment webhooks with idempotency
- `updatePaymentStatus(orderId, updateData)` - Update payment status
- `getPaymentById(orderId)` - Retrieve payment by ID

### Notification Service

- `sendSMSNotification(smsData)` - Send SMS notification
- `sendPaymentNotification(paymentData)` - Send payment notification SMS
- `getNotificationById(notificationId)` - Retrieve notification by ID

### Security & Idempotency

- `extractIdempotencyKey(req, body)` - Extract idempotency key from headers/body
- `checkIdempotencyKey(key)` - Check if request has been processed
- `storeIdempotencyKey(key, data, status)` - Store response for duplicate prevention

### Error Classes

- `SignatureVerificationError` - Signature verification failed (401)
- `InvalidChecksumError` - Invalid checksum format (401)
- `PaymentNotFoundError` - Payment not found (404)
- `InvalidPaymentDataError` - Invalid payment data (400)
- `WebhookValidationError` - Webhook validation failed (400)
- `DuplicateWebhookError` - Duplicate webhook detected (409)

## Logging

The service uses Winston for structured logging with the following features:

- **Console Logs**: Colored, formatted output for development
- **File Logs**: 
  - `logs/error.log` - Error-level logs only
  - `logs/combined.log` - All log levels
- **Log Format**: JSON with timestamps
- **Log Levels**: error, warn, info, http, verbose, debug, silly

## Testing

The project includes comprehensive test coverage with **90+ test cases**:

- **Payment Service Tests**: Test all payment functions with mock data
- **Signature Verification Tests**: Test HMAC validation, typed errors, security context
- **Idempotency Tests**: Test duplicate detection, key extraction, caching
- **Notification Service Tests**: Test SMS sending and notifications
- **API Integration Tests**: End-to-end API testing with Supertest

Test coverage includes:
- ✅ Success scenarios
- ✅ Error handling and typed errors
- ✅ Input validation
- ✅ Security context logging
- ✅ Idempotency and duplicate prevention
- ✅ Edge cases
- ✅ Mock API responses
- ✅ Timing attack prevention

## Security Features

- **Enhanced Signature Verification**: HMAC-SHA256 with constant-time comparison
- **Typed Error Handling**: Structured security errors with context
- **Security Context Logging**: Comprehensive audit trail with IP, User-Agent, timestamps
- **Idempotency Protection**: Prevents duplicate webhook processing
- **Automatic Key Extraction**: From headers (x-idempotency-key, x-request-id) or body
- **Response Caching**: 24-hour TTL for duplicate detection
- **Helmet.js**: Secure HTTP headers
- **CORS**: Cross-origin resource sharing enabled
- **Environment Variables**: Sensitive data stored securely
- **Input Validation**: Request data validation

📖 **See [SECURITY_FEATURES.md](SECURITY_FEATURES.md) for detailed security documentation**  
📖 **See [WEBHOOK_HANDLING.md](WEBHOOK_HANDLING.md) for webhook processing guide**

## Mock Integrations

For development and testing, the service includes mock implementations for:

- **Paytm API**: Mock transaction initiation and responses
- **SMS Provider API**: Mock SMS sending responses

Replace these with actual API integrations in production.

## Production Considerations

Before deploying to production:

1. **Database**: Replace in-memory storage with a proper database (MongoDB, PostgreSQL, etc.)
2. **Real APIs**: Integrate actual Paytm and SMS provider APIs
3. **Security**: 
   - Use strong secrets
   - Enable HTTPS
   - Add rate limiting
   - Implement authentication/authorization
4. **Logging**: Configure log rotation and monitoring
5. **Error Handling**: Set up error tracking (Sentry, etc.)
6. **Scaling**: Consider load balancing and horizontal scaling

## License

ISC

## Support

For issues and questions, please create an issue in the repository.

