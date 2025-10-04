const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const paymentRoutes = require('./routes/paymentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.status(200).send({ status: 'OK' });
});

app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);

module.exports = app;
