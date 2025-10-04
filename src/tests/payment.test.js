process.env.PAYTM_MERCHANT_KEY = 'dummy_key';
process.env.PAYTM_MERCHANT_ID = 'dummy_id';

const request = require('supertest');
const app = require('../app');
const paymentService = require('../services/paymentService');
const crypto = require('crypto');
const config = require('../config/config');

jest.mock('../services/paymentService');

describe('Payment Routes', () => {
    it('should create a payment', async () => {
        paymentService.createPayment.mockResolvedValue({ paymentId: '123' });
        const res = await request(app)
            .post('/api/payments')
            .send({ amount: 100 });
        expect(res.statusCode).toEqual(201);
        expect(res.body).toHaveProperty('paymentId', '123');
    });

    it('should get a payment by id', async () => {
        paymentService.getPaymentById.mockResolvedValue({ paymentId: '123', status: 'SUCCESS' });
        const res = await request(app).get('/api/payments/123');
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('status', 'SUCCESS');
    });

    it('should handle webhook with valid signature', async () => {
        const body = { orderId: '123' };
        const signature = crypto
            .createHmac('sha256', config.paytm.merchantKey)
            .update(JSON.stringify(body))
            .digest('hex');
        
        paymentService.verifyPaytmSignature.mockResolvedValue(true);
        paymentService.handlePaymentWebhook.mockResolvedValue({ success: true });

        const res = await request(app)
            .post('/api/payments/webhook')
            .set('x-paytm-signature', signature)
            .send(body);
        
        expect(res.statusCode).toEqual(200);
    });

    it('should fail webhook with invalid signature', async () => {
        const { SignatureMismatchError } = require('../utils/errors');
        paymentService.verifyPaytmSignature.mockRejectedValue(new SignatureMismatchError('Invalid Paytm signature'));
        
        const res = await request(app)
            .post('/api/payments/webhook')
            .set('x-paytm-signature', 'invalid-signature')
            .send({ orderId: '123' });
        
        expect(res.statusCode).toEqual(400);
        expect(res.body).toHaveProperty('error', 'Invalid Paytm signature');
    });
});
