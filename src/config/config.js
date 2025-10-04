require('dotenv').config();

const config = {
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',
  },
  paytm: {
    merchantId: process.env.PAYTM_MERCHANT_ID,
    merchantKey: process.env.PAYTM_MERCHANT_KEY,
    website: process.env.PAYTM_WEBSITE || 'WEBSTAGING',
    industryType: process.env.PAYTM_INDUSTRY_TYPE || 'Retail',
    channelId: process.env.PAYTM_CHANNEL_ID || 'WEB',
    callbackUrl: process.env.PAYTM_CALLBACK_URL,
  },
  sms: {
    apiKey: process.env.SMS_API_KEY,
    apiSecret: process.env.SMS_API_SECRET,
    senderId: process.env.SMS_SENDER_ID || 'PEGASUS',
    apiUrl: process.env.SMS_API_URL,
  },
  app: {
    secret: process.env.APP_SECRET,
    jwtSecret: process.env.JWT_SECRET,
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

module.exports = config;

