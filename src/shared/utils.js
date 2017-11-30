const { STATUS_CODES } = require('http');

const status = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500
};

module.exports = {
    status: status,
    msg: STATUS_CODES
};