const chai = require('chai');
const chaiHttp = require('chai-http');

const serverPromise = require('../src/index');

const { expect } = chai;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // Ignore unsigned ssl certificate

chai.use(chaiHttp);

describe('Test API', () => {
  let server;

  before(async () => {
    server = await serverPromise;
  });

  describe('Test /api/applications', () => {
    it('Non-authenticated should fail', (done) => {
      chai.request(server)
        .get('/api/applications')
        .end((err, res) => {
          expect(res).to.have.status(400);
          done();
        });
    });

    it('Wrong authentication should fail', (done) => {
      chai.request(server)
        .get('/api/applications')
        .auth('wrong_user', 'wrong_password')
        .end((err, res) => {
          expect(res).to.have.status(401);
          done();
        });
    });
  });
});
