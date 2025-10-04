const rewire = require('rewire');
const paymentService = rewire('../services/paymentService');

describe('Payment Service', () => {
    afterEach(() => {
        jest.clearAllMocks();
        // Clear the in-memory store after each test
        const payments = paymentService.__get__('payments');
        payments.clear();
    });

    describe('createPayment', () => {
        it('should create and store a payment', async () => {
            const paymentDetails = { amount: 200, currency: 'INR' };
            const result = await paymentService.createPayment(paymentDetails);
            expect(result.success).toBe(true);
            expect(result.paymentId).toBeDefined();
            expect(result.token).toBeDefined();

            const storedPayment = await paymentService.getPaymentById(result.paymentId);
            expect(storedPayment.status).toEqual('PENDING');
            expect(storedPayment.amount).toEqual(200);
        });
    });

    describe('getPaymentById', () => {
        it('should retrieve an existing payment', async () => {
            const paymentDetails = { amount: 300, currency: 'USD' };
            const { paymentId } = await paymentService.createPayment(paymentDetails);
            const retrievedPayment = await paymentService.getPaymentById(paymentId);
            expect(retrievedPayment.paymentId).toEqual(paymentId);
            expect(retrievedPayment.amount).toEqual(300);
        });

        it('should return null for a non-existent payment', async () => {
            const retrievedPayment = await paymentService.getPaymentById('non-existent-id');
            expect(retrievedPayment).toBeNull();
        });
    });
});
