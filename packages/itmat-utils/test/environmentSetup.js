const { v4: uuid } = require('uuid');
const { minioContainerSetup, minioContainerTeardown } = require('../../config/testEnvironment.config');
const NodeEnvironment = require('jest-environment-jsdom-fourteen');

class CustomEnvironment extends NodeEnvironment {
    constructor(config, context) {
        super(config, context);
    }

    async setup() {
        await super.setup();
        this.global.__DOCKER_CONTAINER__ = uuid();
        this.global.__MINIO_PORT__ = await minioContainerSetup(this.global.__DOCKER_CONTAINER__, 9050);
    }

    async teardown() {
        await minioContainerTeardown(this.global.__DOCKER_CONTAINER__);
        await super.teardown();
    }

    runScript(script) {
        return super.runScript(script);
    }
}

module.exports = CustomEnvironment;