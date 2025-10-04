# Quick Setup Guide

## 1. Install Dependencies

```bash
npm install
```

## 2. Environment Setup

The project includes a `.env.example` file. For development, you can use the mock values:

- The service will work with mock Paytm and SMS APIs
- All configuration is already set for local development
- Mock merchant keys and API keys are pre-configured for testing

## 3. Run the Application

### Start Development Server
```bash
npm run dev
```

### Start Production Server
```bash
npm start
```

The server will be available at: `http://localhost:3000`

## 4. Test the Health Endpoint

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "UP",
  "timestamp": "2025-10-04T...",
  "uptime": 1.234,
  "environment": "development",
  "service": "payments-notifications-service"
}
```

## 5. Run Tests

```bash
npm test
```

This will run all unit tests and API integration tests with coverage report.

## 6. Test Payment Flow

### Create a Payment
```bash
curl -X POST http://localhost:3000/api/payments/create \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "CUST_123",
    "amount": 1000,
    "currency": "INR",
    "description": "Test payment",
    "email": "test@example.com",
    "mobile": "9876543210"
  }'
```

### Get Payment Status
```bash
curl http://localhost:3000/api/payments/ORDER_<order-id>
```

### Send SMS Notification
```bash
curl -X POST http://localhost:3000/api/notifications/sms \
  -H "Content-Type: application/json" \
  -d '{
    "mobile": "9876543210",
    "message": "Test SMS notification"
  }'
```

## Project Structure

```
Pegasus2.0/
├── src/
│   ├── config/         # Configuration files
│   ├── routes/         # API routes
│   ├── services/       # Business logic
│   ├── utils/          # Utilities (logger)
│   └── server.js       # Express server
├── __tests__/          # Test files
├── logs/               # Log files (auto-generated)
├── package.json
└── README.md
```

## Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with auto-reload
- `npm test` - Run tests with coverage
- `npm run test:watch` - Run tests in watch mode

## Next Steps

1. Review the code structure in `src/` directory
2. Check the test files in `__tests__/` directory
3. Read the full documentation in `README.md`
4. Customize configuration in `.env` for your needs
5. Replace mock APIs with real integrations for production

## Notes

- All third-party integrations use mock data for development
- Payments are stored in-memory (use database in production)
- Logs are written to `logs/` directory
- Winston logger provides structured logging
- Full test coverage included

