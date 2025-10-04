const request = require('supertest');
const app = require('../app');
const notificationService = require('../services/notificationService');

jest.mock('../services/notificationService');

describe('Notification Routes', () => {
    it('should send an SMS', async () => {
        notificationService.sendSMSNotification.mockResolvedValue({ success: true, messageId: '456' });
        const res = await request(app)
            .post('/api/notifications/sms')
            .send({ phoneNumber: '1234567890', message: 'Test' });
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('messageId', '456');
    });
});
