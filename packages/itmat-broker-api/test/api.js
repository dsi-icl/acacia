const chai = require('chai');
const chaiHttp = require('chai-http');
const fs = require('fs');
const mongodb = require('mongodb');

const Server = require('../src/server');

const { expect } = chai;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // Ignore unsigned ssl certificate

chai.use(chaiHttp);

describe('Test API', () => {
    let db, fileLogCollection, dataLogCollection, usedToken, token, server, username, password,
        file, nofile, applications, id, key;

    before(async () => {
        let configFile, config;

        if (!process.env.ITMAT_TEST_CONFIG)
            throw Error('The ITMAT_TEST_CONFIG environment variable must be set to your test config file');
        else {
            configFile = fs.readFileSync(process.env.ITMAT_TEST_CONFIG);
            config = JSON.parse(configFile);
            server = await new Server(config).start();
            db = await mongodb.MongoClient.connect(config.database.mongo_url);
            dataLogCollection = db.collection(config.database.data_log_collection);
            const dataLogCollectionCount = await dataLogCollection.count();
            if(dataLogCollectionCount > 0) throw Error(`Collection ${config.database.data_log_collection} should be empty`);
            fileLogCollection = db.collection(config.database.file_log_collection);
            const fileLogCollectionCount = await fileLogCollection.count();
            if(fileLogCollectionCount > 0) throw Error(`Collection ${config.database.file_log_collection} should be empty`);
            username = config.test.username;
            password = config.test.password;
            file = config.test.accessible_file;
            nofile = config.test.forbidden_file;
        }
    });

    after(async () => {
        if(server) await server.close();
    });

    describe('Test login and tokens', () => {
        it('Get applications without being logged', (done) => {
            chai.request(server)
                .get('/applications')
                .end((err, res) => {
                    expect(res).to.have.status(400);
                    done();
                });
        });

        it('Login with bad request', (done) => {
            chai.request(server)
                .get('/login')
                .end((err, res) => {
                    expect(res).to.have.status(400);
                    done();
                });
        });

        it('Login with wrong credentials', (done) => {
            chai.request(server)
                .get('/login')
                .auth('wrongusername', 'wrongpassword')
                .end((err, res) => {
                    expect(res).to.have.status(401);
                    done();
                });
        });

        it('Login with correct credentials', (done) => {
            chai.request(server)
                .get('/login')
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
                .set('Authorization', `Bearer ${  token}`)
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
                .set('Authorization', `Bearer ${  usedToken}`)
                .end((err, res) => {
                    expect(res).to.have.status(401);
                    done();
                });
        });

        it('Get applications again with next token', (done) => {
            chai.request(server)
                .get('/applications')
                .set('Authorization', `Bearer ${  token}`)
                .end((err, res) => {
                    expect(res).to.have.status(200);
                    token = res.headers['next-token'];
                    done();
                });
        });

        it('Logout using wrong token', (done) => {
            chai.request(server)
                .get('/logout')
                .set('Authorization', 'Bearer invalidtoken')
                .end((err, res) => {
                    expect(res).to.have.status(401);
                    done();
                });
        });

        it('Logout using correct token', (done) => {
            chai.request(server)
                .get('/logout')
                .set('Authorization', `Bearer ${  token}`)
                .end((err, res) => {
                    expect(res).to.have.status(200);
                    done();
                });
        });

        it('Get applications with invalidated token', (done) => {
            chai.request(server)
                .get('/applications')
                .set('Authorization', `Bearer ${  token}`)
                .end((err, res) => {
                    expect(res).to.have.status(401);
                    done();
                });
        });
    });

    describe('Test file access', () => {
        it('Login', (done) => {
            chai.request(server)
                .get('/login')
                .auth(username, password)
                .end((err, res) => {
                    token = res.text;
                    done();
                });
        });

        it('Access non-existing file', (done) => {
            chai.request(server)
                .get('/file/thisfiledoesnotexist')
                .set('Authorization', `Bearer ${  token}`)
                .end((err, res) => {
                    token = res.headers['next-token'];
                    expect(res).to.have.status(403);
                    done();
                });
        });

        it('Access non-authorized file', (done) => {
            chai.request(server)
                .get(`/file/${nofile}`)
                .set('Authorization', `Bearer ${  token}`)
                .end((err, res) => {
                    token = res.headers['next-token'];
                    expect(res).to.have.status(403);
                    done();
                });
        });

        it('No recent access to the file in the log should exists', (done) => {
            fileLogCollection.findOne({ user: username, file: file }).then(result=>{
                if(result === null) done();
                else done(new Error('Recent access already exists'));
            });
        });

        it('Access authorized file', (done) => {
            chai.request(server)
                .get(`/file/${file}`)
                .set('Authorization', `Bearer ${  token}`)
                .end((err, res) => {
                    token = res.headers['next-token'];
                    expect(res).to.have.status(200);
                    done();
                });
        });

        it('Recent access to the file in the log should exists', (done) => {
            fileLogCollection.findOne({ user: username, file: file }).then(result=>{
                if(result === null) done(new Error('Recent access does not exists'));
                else done();
            });
        });

        it('Login maintaining old token', (done) => {
            chai.request(server)
                .get('/login')
                .auth(username, password)
                .end((err, res) => {
                    expect(res).to.have.status(200);
                    done();
                });
        });

        it('Access authorized file with old unused token', (done) => {
            chai.request(server)
                .get(`/file/${file}`)
                .set('Authorization', `Bearer ${  token}`)
                .end((err, res) => {
                    expect(res).to.have.status(401);
                    done();
                });
        });
    });

    describe('Test data access', () => {
        it('Login with correct credentials', (done) => {
            chai.request(server)
                .get('/login')
                .auth(username, password)
                .end((err, res) => {
                    expect(res).to.have.status(200);
                    token = res.text;
                    done();
                });
        });

        it('Get applications with right token', (done) => {
            chai.request(server)
                .get('/applications')
                .set('Authorization', `Bearer ${  token}`)
                .end((err, res) => {
                    expect(res).to.have.status(200);
                    usedToken = token;
                    token = res.headers['next-token'];
                    applications = res.body;
                    done();
                });
        });

        it('Query first available dataset', (done) => {
            if(applications.length === 0) throw Error('There are not applications available for the current user');
            const application = applications[0];
            const keys = Object.keys(application.data);
            if(keys.length === 0) throw Error('There are not datasets associated with the application');
            id = application._id;
            key = keys[0];

            chai.request(server)
                .get(`/data/${id}/${key}`)
                .set('Authorization', `Bearer ${  token}`)
                .end((err, res) => {
                    expect(res).to.have.status(200);
                    usedToken = token;
                    token = res.headers['next-token'];
                    done();
                });
        });

        it('No recent access to the dataset in the log should exists', (done) => {
            dataLogCollection.findOne({ user: username, application: id, key: key }).then(result=>{
                if(result === null) done();
                else done(new Error('Recent access already exists'));
            });
        });

        it('Query first available dataset with used token', (done) => {
            chai.request(server)
                .get(`/data/${id}/${key}`)
                .set('Authorization', `Bearer ${  usedToken}`)
                .end((err, res) => {
                    expect(res).to.have.status(401);
                    done();
                });
        });

        it('Recent access to the dataset in the log should exists', (done) => {
            dataLogCollection.findOne({ user: username, application: new mongodb.ObjectId(id), key: key }).then(result=>{
                if(result === null) done(new Error('Recent access does not exists'));
                else done();
            });
        });

        it('Query non-existing dataset (using wrong key)', (done) => {
            chai.request(server)
                .get(`/data/${id}/wrongkey`)
                .set('Authorization', `Bearer ${  token}`)
                .end((err, res) => {
                    expect(res).to.have.status(403);
                    usedToken = token;
                    token = res.headers['next-token'];
                    done();
                });
        });

        it('Logout using correct token', (done) => {
            chai.request(server)
                .get('/logout')
                .set('Authorization', `Bearer ${  token}`)
                .end((err, res) => {
                    expect(res).to.have.status(200);
                    done();
                });
        });

    });
});
