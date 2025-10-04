const express = require('express');
const notificationController = require('../controllers/notificationController');

const router = express.Router();

router.post('/sms', notificationController.sendSMS);

module.exports = router;
