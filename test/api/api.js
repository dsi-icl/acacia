const chai = require('chai');
const chaiHttp = require('chai-http');

const Server = require('../../src/api/api-server');

const { expect } = chai;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // Ignore unsigned ssl certificate

chai.use(chaiHttp);

describe('Test API', () => {
  let token;
  let token2;
  let token3;
  let server;

  before(async () => {
    server = await new Server('ITMAT_CONFIG_TEST').start();
    if(!process.env.ITMAT_USERNAME_TEST)
      throw Error('The ITMAT_USERNAME_TEST environment variable must be set');
    if(!process.env.ITMAT_PASSWORD_TEST)
      throw Error('The ITMAT_PASSWORD_TEST environment variable must be set');
  });

  after(async () => {
    if(server) await server.close();
  });

  describe('Test login and tokens', () => {
    it('Get applications without being logged', (done) => {
      chai.request(server)
        .get('/applications')
        .end((err, res) => {
          expect(res).to.have.status(401);
          done();
        });
    });

    it('Login with bad request', (done) => {
      chai.request(server)
        .post('/login')
        .end((err, res) => {
          expect(res).to.have.status(400);
          done();
        });
    });

    it('Login with wrong credentials', (done) => {
      chai.request(server)
        .post('/login')
        .auth('wrongusername', 'wrongpassword')
        .end((err, res) => {
          expect(res).to.have.status(401);
          done();
        });
    });

    it('Login with correct credentials', (done) => {
      chai.request(server)
        .post('/login')
        .auth(process.env.ITMAT_USERNAME_TEST, process.env.ITMAT_PASSWORD_TEST)
        .end((err, res) => {
          expect(res).to.have.status(200);
          token = res.text;
          done();
        });
    });

    it('Get applications with wrong token', (done) => {
      chai.request(server)
        .get('/applications')
        .set('Authorization', 'Bearer invalidtoken')
        .end((err, res) => {
          expect(res).to.have.status(401);
          done();
        });
    });

    it('Get applications with right token', (done) => {
      chai.request(server)
        .get('/applications')
        .set('Authorization', 'Bearer ' + token)
        .end((err, res) => {
          expect(res).to.have.status(200);
          token = res.text;
          token2 = res.headers['next-token'];
          done();
        });
    });

    it('Get applications with used token', (done) => {
      chai.request(server)
        .get('/applications')
        .set('Authorization', 'Bearer ' + token)
        .end((err, res) => {
          expect(res).to.have.status(401);
          token = res.text;
          done();
        });
    });

    it('Get applications again with next token', (done) => {
      chai.request(server)
        .get('/applications')
        .set('Authorization', 'Bearer ' + token2)
        .end((err, res) => {
          expect(res).to.have.status(200);
          token3 = res.headers['next-token'];
          done();
        });
    });

    it('Logout using wrong token', (done) => {
      chai.request(server)
        .post('/logout')
        .set('Authorization', 'Bearer invalidtoken')
        .end((err, res) => {
          expect(res).to.have.status(401);
          done();
        });
    });

    it('Logout using correct token', (done) => {
      chai.request(server)
        .post('/logout')
        .set('Authorization', 'Bearer ' + token3)
        .end((err, res) => {
          expect(res).to.have.status(200);
          done();
        });
    });

    it('Get applications with invalidated token', (done) => {
      chai.request(server)
        .get('/applications')
        .set('Authorization', 'Bearer ' + token3)
        .end((err, res) => {
          expect(res).to.have.status(401);
          done();
        });
    });


  });
});
