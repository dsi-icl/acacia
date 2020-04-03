const testConfig = require('./test.config.js');
const { Account, Container, Segment } = require('../src/index.js');
const fs = require('fs');
const MemoryStream = require('memorystream');

let segment_account = Account.fromUsernameAndPassword(testConfig.store_url,
                        testConfig.account_user, testConfig.account_password);
let segment_container = undefined;

beforeAll(function() {
    return segment_account.connect().then(function() {
        segment_container = new Container(segment_account, testConfig.segment_container_name);
        return segment_container.create();
    }, function(error) {
        throw error.toString();
    })
});

test('Segment create from disk', function(done) {
    expect.assertions(3);
    expect(segment_account.isConnected()).toBeTruthy();
    expect(segment_container).toBeDefined();
    let obj = new Segment(segment_container, testConfig.segment_object_name);
    obj.createFromDisk('./tests/test.config.js').then(function(ok) {
        expect(ok).toBeTruthy();
        done();
    }, function(error) {
        done.fail(error.toString());
    });
});

test('Segment update from stream', function(done) {
    expect.assertions(3);
    expect(segment_account.isConnected()).toBeTruthy();
    expect(segment_container).toBeDefined();
    let obj = new Segment(segment_container, testConfig.segment_object_name);
    let ms = new MemoryStream('');
    obj.createFromStream(ms).then(function(ok) {
        expect(ok).toBeTruthy();
        done();
    }, function(error) {
        done.fail(error.toString());
    });
    ms.end('coucou hibou');
});

test('Segment setMetadata', function(done) {
    expect.assertions(3);
    expect(segment_account.isConnected()).toBeTruthy();
    expect(segment_container).toBeDefined();
    let obj = new Segment(segment_container, testConfig.segment_object_name);
    obj.setMetadata({test: 'coucou'}).then(function(ok) {
        expect(ok).toBeTruthy();
        done();
    }, function(error) {
        done.fail(error.toString());
    });
});

test('Segment getMetadata', function(done) {
    expect.assertions(3);
    expect(segment_account.isConnected()).toBeTruthy();
    expect(segment_container).toBeDefined();
    let obj = new Segment(segment_container, testConfig.segment_object_name);
    obj.getMetadata().then(function(data) {
        expect(data.test).toEqual('coucou');
        done();
    }, function(error) {
        done.fail(error.toString());
    });
});

test('Segment update metadata', function(done) {
    expect.assertions(4);
    expect(segment_account.isConnected()).toBeTruthy();
    expect(segment_container).toBeDefined();
    let obj = new Segment(segment_container, testConfig.segment_object_name);
    obj.setMetadata({test: 'coucou_update'}).then(function(ok) {
        expect(ok).toBeTruthy();
        obj.getMetadata().then(function(data) {
            expect(data.test).toEqual('coucou_update');
            done();
        }, function(error) {
            done.fail(error.toString());
        });
    }, function(error) {
        done.fail(error.toString());
    });
});

test('Segment content check', function(done) {
    expect.assertions(6);
    expect(segment_account.isConnected()).toBeTruthy();
    expect(segment_container).toBeDefined();
    let obj = new Segment(segment_container, testConfig.segment_object_name);
    obj.getContentStream().then(function(stream) {
        expect(stream).not.toBeNull();
        expect(stream).toBeDefined();
        expect(stream.isPaused()).toBeFalsy();
        let content = '';
        stream.on('data', function(data) {
            content += data;
        });
        stream.on('end', function() {
            let ref = 'coucou hibou';
            expect(content).toEqual(ref);
            done();
        });
        stream.on('error', function(error) {
            done.fail(error.toString());
        });
    }, function(error) {
        done.fail(error.toString());
    });
});

test('Segment delete', function(done) {
    expect.assertions(3);
    expect(segment_account.isConnected()).toBeTruthy();
    expect(segment_container).toBeDefined();
    let obj = new Segment(segment_container, testConfig.segment_object_name);
    obj.delete().then(function(ok) {
        expect(ok).toBeTruthy();
        done();
    }, function(error) {
        done.fail(error.toString());
    });
});

test('Segment create from stream', function(done) {
    expect.assertions(3);
    expect(segment_account.isConnected()).toBeTruthy();
    expect(segment_container).toBeDefined();
    let obj = new Segment(segment_container, testConfig.segment_object_name);
    let stream = new MemoryStream('');
    obj.createFromStream(stream).then(function(ok) {
        expect(ok).toBeTruthy();
        done();
    }, function(error) {
        done.fail(error.toString());
    });
    stream.end();
});

test('Segment empty delete', function(done) {
    expect.assertions(3);
    expect(segment_account.isConnected()).toBeTruthy();
    expect(segment_container).toBeDefined();
    let obj = new Segment(segment_container, testConfig.segment_object_name);
    obj.delete().then(function(ok) {
        expect(ok).toBeTruthy();
        done();
    }, function(error) {
        done.fail(error.toString());
    });
});

afterAll(function() {
    return segment_container.delete().then(function(ok) {
        return segment_account.disconnect();
    }, function(error) {
        throw error.toString();
    });
});

/*
test('Segment ', function(done) {
    expect.assertions(2);
    let account = Account.fromUsernameAndPassword(testConfig.store_url, testConfig.account_user, testConfig.account_password);
    account.connect().then(function () {
        expect(account.isConnected()).toBeTruthy();
        let container = new Container(account, testConfig.segment_container_name);
        let obj = new Segment(segment_container, testConfig.segment_object_name);
    }, function (error) {
        done.fail(error.toString());
    });
});
*/