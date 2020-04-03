const testConfig = require('./test.config.js');
const { Account, Container } = require('../src/index.js');

let container_account = Account.fromUsernameAndPassword(testConfig.store_url,
    testConfig.account_user, testConfig.account_password);
beforeAll(function() {
    return container_account.connect();
});

test('Container list non existing', function(done) {
    expect.assertions(2);
    expect(container_account.isConnected()).toBeTruthy();
    let container = new Container(container_account, testConfig.container_name);
    container.listObjects().then(function(data) {
        done.fail(data);
    }, function(error) {
        expect(error).toBeDefined();
        done();
    });
});

test('Container create', function(done) {
    expect.assertions(2);
    expect(container_account.isConnected()).toBeTruthy();
    let container = new Container(container_account, testConfig.container_name);
    container.create().then(function(data) {
        expect(data).not.toBeNull();
        done();
    }, function(error) {
        done.fail(error.toString());
    });
});

test('Container list empty', function(done) {
    expect.assertions(2);
    expect(container_account.isConnected()).toBeTruthy();
    let container = new Container(container_account, testConfig.container_name);
    container.listObjects().then(function(data) {
        expect(data).toBeDefined();
        done();
    }, function(error) {
        done.fail(error.toString());
    });
});

test('Container get empty metadata', function(done) {
    expect.assertions(2);
    expect(container_account.isConnected()).toBeTruthy();
    let container = new Container(container_account, testConfig.container_name);
    container.getMetadata().then(function(metadata) {
        expect(metadata).not.toBeNull();
        done();
    }, function(error) {
        done.fail(error.toString());
    });
});


test('Container create metadata', function(done) {
    expect.assertions(2);
    expect(container_account.isConnected()).toBeTruthy();
    let container = new Container(container_account, testConfig.container_name);
    container.setMetadata({test: 'test'}).then(function(update_status) {
        expect(update_status).toBeTruthy();
        done();
    }, function(error) {
        done.fail(error.toString());
    });
});

test('Container set metadata', function(done) {
    expect.assertions(2);
    expect(container_account.isConnected()).toBeTruthy();
    let container = new Container(container_account, testConfig.container_name);
    container.setMetadata({test: 'test_update'}).then(function(update_status) {
        expect(update_status).toBeTruthy();
        done();
    }, function(error) {
        done.fail(error.toString());
    });
});

test('Container get metadata', function(done) {
    expect.assertions(2);
    expect(container_account.isConnected()).toBeTruthy();
    let container = new Container(container_account, testConfig.container_name);
    container.getMetadata().then(function(metadata) {
        expect(metadata.test).toEqual('test_update');
        done();
    }, function(error) {
        done.fail(error.toString());
    });
});


test('Container delete metadata', function(done) {
    expect.assertions(2);
    expect(container_account.isConnected()).toBeTruthy();
    let container = new Container(container_account, testConfig.container_name);
    container.setMetadata({test: ''}).then(function(update_status) {
        expect(update_status).toBeTruthy();
        done();
    }, function(error) {
        done.fail(error.toString());
    });
});

test('Container delete', function(done) {
    expect.assertions(3);
    expect(container_account.isConnected()).toBeTruthy();
    let container = new Container(container_account, testConfig.container_name);
    container.delete().then(function(data) {
        expect(data).not.toBeNull();
        expect(data).toBeTruthy();
        done();
    }, function(error) {
        done.fail(error.toString());
    });
});

afterAll(function() {
    return container_account.disconnect();
});