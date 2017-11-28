const chai = require('chai');
const chaiHttp = require('chai-http');
const fs = require('fs');

const Server = require('../../src/client/client-server');

const { expect } = chai;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // Ignore unsigned ssl certificate

chai.use(chaiHttp);

describe('Test client', () => {
  let server;
  
  before(async () => {
    server = await new Server('ITMAT_CONFIG_TEST').start();
  });

  after(async () => {
    if(server) await server.close();
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
