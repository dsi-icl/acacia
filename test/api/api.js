const chai = require('chai');
const chaiHttp = require('chai-http');

const Server = require('../../src/api/api-server');

const { expect } = chai;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // Ignore unsigned ssl certificate

chai.use(chaiHttp);

describe('Test API', () => {
  let usedToken, token, server, username, password, file, nofile;

  before(async () => {
    server = await new Server('ITMAT_CONFIG_TEST').start();
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
        .auth(username, password)
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
          usedToken = token;
          token = res.headers['next-token'];
          done();
        });
    });

    it('Get applications with used token', (done) => {
      chai.request(server)
        .get('/applications')
        .set('Authorization', 'Bearer ' + usedToken)
        .end((err, res) => {
          expect(res).to.have.status(401);
          done();
        });
    });

    it('Get applications again with next token', (done) => {
      chai.request(server)
        .get('/applications')
        .set('Authorization', 'Bearer ' + token)
        .end((err, res) => {
          expect(res).to.have.status(200);
          token = res.headers['next-token'];
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
        .set('Authorization', 'Bearer ' + token)
        .end((err, res) => {
          expect(res).to.have.status(200);
          done();
        });
    });

    it('Get applications with invalidated token', (done) => {
      chai.request(server)
        .get('/applications')
        .set('Authorization', 'Bearer ' + token)
        .end((err, res) => {
          expect(res).to.have.status(401);
          done();
        });
    });
  });

  describe('Test file access', () => {
    it('Login', (done) => {
      chai.request(server)
      .post('/login')
      .auth(username, password)
      .end((err, res) => {
        token = res.text;
        done();
      })
    });

    it('Access non-existing file', (done) => {
        chai.request(server)
        .get('/file')
        .query({name: 'thisfilenotexists'})
        .set('Authorization', 'Bearer ' + token)
        .end((err, res) => {
          token = res.headers['next-token'];
          expect(res).to.have.status(403);
          done();
        });
    });

    it('Access non-authorized file', (done) => {
      chai.request(server)
      .get('/file')
      .query({name: nofile})
      .set('Authorization', 'Bearer ' + token)
      .end((err, res) => {
        token = res.headers['next-token'];
        expect(res).to.have.status(403);
        done();
      });
    });

    it('Access authorized file', (done) => {
      chai.request(server)
      .get('/file')
      .query({name: file})
      .set('Authorization', 'Bearer ' + token)
      .end((err, res) => {
        token = res.headers['next-token'];
        expect(res).to.have.status(200);
        done();
      });
    });

    it('Login maintaining old token', (done) => {
      chai.request(server)
      .post('/login')
      .auth(username, password)
      .end((err, res) => {
        expect(res).to.have.status(200);
        done();
      })
    });

    it('Access authorized file with old unused token', (done) => {
      chai.request(server)
      .get('/file')
      .query({name: file})
      .set('Authorization', 'Bearer ' + token)
      .end((err, res) => {
        expect(res).to.have.status(401);
        done();
      });
    });
  });

  describe('Test data access', () => {
    // TODO
  });
});
