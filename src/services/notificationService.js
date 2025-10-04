const sendSMSNotification = async (phoneNumber, message) => {
  // Mock implementation
  console.log(`Sending SMS to ${phoneNumber}: ${message}`);
  return { success: true, messageId: `SMS_${Date.now()}` };
};

module.exports = {
  sendSMSNotification,
};
