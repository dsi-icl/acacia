const NodeEnvironment = require('jest-environment-node');
const { minioContainerSetup, minioContainerTeardown } = require('./_minioHelper');

class CustomEnvironment extends NodeEnvironment {
    constructor(config, context) {
        super(config, context);
        this.testPath = context.testPath;
        this.docblockPragmas = context.docblockPragmas;
        this.minioContainerName = undefined;
    }

    async setup() {
        await super.setup();
        this.global.hasMinio = false;
        if (this.docblockPragmas.with === 'Minio') {
            const containerSetup = await minioContainerSetup().then(res => {
                this.global.hasMinio = true;
                return res;
            }).catch(() => {
                this.global.hasMinio = false;
            });

            if (containerSetup) {
                const [minioContainer, minioPort] = containerSetup;
                this.minioContainerName = minioContainer;
                this.global.minioContainerPort = minioPort;
            }
        }
        return;
    }

    async teardown() {
        if (this.minioContainerName)
            await minioContainerTeardown(this.minioContainerName);
        await super.teardown();
        return;
    }

    runScript(script) {
        return super.runScript(script);
    }
}

module.exports = CustomEnvironment;
