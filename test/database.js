const chai = require('chai');
const chaiHttp = require('chai-http');

const serverPromise = require('../src/index');

const { expect } = chai;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // Ignore unsigned ssl certificate

chai.use(chaiHttp);

describe('Test database', () => {
  let server;

  before(async () => {
    server = await serverPromise;
  });
});
