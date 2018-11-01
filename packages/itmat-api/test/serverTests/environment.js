/*eslint no-console: "off"*/

'use strict';

const server = require('../../dist/src/server/server').APIServer;
const NodeEnvironment = require('jest-environment-node');
const config = require('../../config/config._test.js');

let app;

class ItmatNodeEnvironment extends NodeEnvironment {

    constructor(config) {
        super(config);
    }

    static globalSetup() {
        process.env.NODE_ENV = 'test';
        console.log('\n');
        return new server(config).initialise()
            .then(itmatAPIapp => {
                app = itmatAPIapp;
                return true;
            }).catch(err => {
                console.error(err);
            });
    }

    async setup() {
        super.setup();
        this.global.app = app;
    }

    async teardown() {
        super.teardown();
    }

    runScript(script) {
        return super.runScript(script);
    }
}

module.exports = ItmatNodeEnvironment;