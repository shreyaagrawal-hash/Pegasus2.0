class SignatureMismatchError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SignatureMismatchError';
    this.statusCode = 400;
  }
}

module.exports = {
  SignatureMismatchError,
};
