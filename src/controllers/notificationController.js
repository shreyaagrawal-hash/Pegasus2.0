const notificationService = require('../services/notificationService');

const sendSMS = async (req, res) => {
    try {
        const { phoneNumber, message } = req.body;
        const result = await notificationService.sendSMSNotification(phoneNumber, message);
        res.status(200).send(result);
    } catch (error) {
        res.status(500).send({ error: 'Failed to send SMS' });
    }
};

module.exports = {
    sendSMS,
};
