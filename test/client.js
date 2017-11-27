const chai = require('chai');
const chaiHttp = require('chai-http');

const serverPromise = require('../src/index');

const { expect } = chai;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // Ignore unsigned ssl certificate

chai.use(chaiHttp);

describe('Test client', () => {
  let server;

  before(async () => {
    server = await serverPromise;
  });

  it('Test root page', (done) => {
    chai.request(server)
      .get('/')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(err).to.be.null;
        done();
      });
  });
});
