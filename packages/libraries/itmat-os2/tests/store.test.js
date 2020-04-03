const testConfig = require('./test.config.js');

const { Store } = require('../src/index.js');

test('Store list capabilities', function(done) {
        expect.assertions(1);

        var test_store = new Store(testConfig.store_url);
        test_store.info().then(function (features) {
            expect(features.hasOwnProperty('swift')).toBeTruthy();
            done();
        }, function (error) {
            done.fail(error);
        });
    }
 );

test('Store list capabilities fail', function(done) {
        expect.assertions(1);

        var test_store = new Store('http://invalid-url.test.com');
        test_store.info().then(function (features) {
            done.fail(features);
        }, function (error) {
            expect(error).toBeInstanceOf(Error);
            done();
        });
    }
);


