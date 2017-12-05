const chai = require('chai');
const chaiHttp = require('chai-http');
const fs = require('fs');

const Server = require('../src/server');

const { expect } = chai;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // Ignore unsigned ssl certificate

chai.use(chaiHttp);

describe('Test client', () => {
  let server;
  
  before(async () => {
    let configFile, config;

    if (!process.env.ITMAT_CONFIG_TEST)
      throw Error('The ITMAT_CONFIG_TEST environment variable must be set to your config file');
    else {
      configFile = fs.readFileSync(process.env.ITMAT_CONFIG_TEST);
      config = JSON.parse(configFile);
      server = await new Server(config).start();
    }
    if(!process.env.ITMAT_USERNAME_TEST)
      throw Error('The ITMAT_USERNAME_TEST environment variable must be set');
    else username = process.env.ITMAT_USERNAME_TEST;
    if(!process.env.ITMAT_PASSWORD_TEST)
      throw Error('The ITMAT_PASSWORD_TEST environment variable must be set');
    else password = process.env.ITMAT_PASSWORD_TEST;
    if(!process.env.ITMAT_FILE_TEST)
      throw Error('The ITMAT_FILE_TEST environment variable must be set');
    else file = process.env.ITMAT_FILE_TEST;
    if(!process.env.ITMAT_NO_FILE_TEST)
      throw Error('The ITMAT_NO_FILE_TEST environment variable must be set');
    else nofile = process.env.ITMAT_NO_FILE_TEST;
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
