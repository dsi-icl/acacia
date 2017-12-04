const { STATUS_CODES } = require('http');

const status = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
};

/**
  * Shows a error message and stops the execution with an error.
  * @param {string} message - The message describing the error.
  */
function fatalError(message) {
  console.error(`Fatal error: ${message}`);
  process.exit(1);
}

module.exports = {
  status,
  msg: STATUS_CODES,
  fatalError,
};
