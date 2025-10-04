require('dotenv').config();

const app = require('./app');
const config = require('./config/config');
const logger = require('./utils/logger');

const server = app.listen(config.port, () => {
  logger.info(`Server is running on port ${config.port}`);
});

module.exports = server;
