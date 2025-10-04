const request = require('supertest');
const app = require('../app');
const paymentService = require('../services/paymentService');

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

    it('should handle webhook', async () => {
        paymentService.verifyPaytmSignature.mockResolvedValue(true);
        paymentService.handlePaymentWebhook.mockResolvedValue({ success: true });
        const res = await request(app)
            .post('/api/payments/webhook')
            .set('x-paytm-signature', 'valid-signature')
            .send({ orderId: '123' });
        expect(res.statusCode).toEqual(200);
    });
});
