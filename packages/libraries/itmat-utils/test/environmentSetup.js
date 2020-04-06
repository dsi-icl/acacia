const fetch = require('node-fetch');
const crossSpawn = require('cross-spawn');
let chalk = require('chalk');
let { v4: uuid } = require('uuid');
const { choosePort } = require('react-dev-utils/WebpackDevServerUtils');
const NodeEnvironment = require('jest-environment-jsdom-fourteen');

class CustomEnvironment extends NodeEnvironment {
    constructor(config, context) {
        super(config, context);
        this.testPath = context.testPath;
        this.docblockPragmas = context.docblockPragmas;
    }

    async setup() {
        console.error('BEGIN');
        await super.setup();
        await new Promise((resolve) => {
            try {
                this.global.__DOCKER_CONTAINER__ = uuid();
                choosePort('localhost', 9050).then((port) => {
                    if (port === null) {
                        console.error('Docker container could not be brought up.');
                        process.exit(1);
                    }
                    this.global.__MINIO_PORT__ = port;
                    crossSpawn.sync('docker --version', { stdio: 'inherit' });
                    crossSpawn.sync('docker pull "minio/minio:latest"');
                    const minioProcess = crossSpawn('docker', [
                        'run', '--rm',
                        '--name', `${this.global.__DOCKER_CONTAINER__}`,
                        '-p', `${this.global.__MINIO_PORT__}:9000`,
                        'minio/minio:latest',
                        'server', '/data'
                    ]);
                    minioProcess.on('error', (error) => {
                        throw new Error(error.message);
                    });
                    minioProcess.on('exit', (code) => {
                        if (code !== 0) {
                            console.error('Container failed.');
                            process.exit(1);
                        }
                    });
                    let fetchAttempt = 0;
                    const fetchPoll = setInterval(() => {
                        fetch(`http://localhost:${this.global.__MINIO_PORT__}`)
                            .then(res => {
                                if (res.status === 403) {
                                    clearInterval(fetchPoll);
                                    console.log(chalk.green('Docker Minio has started up.'));
                                    resolve();
                                } else {
                                    console.error(`Unexpected server status ${res.status}`);
                                    crossSpawn.sync(`docker stop "${this.global.__DOCKER_CONTAINER__}"`, { stdio: 'inherit' });
                                    process.exit(1);
                                }
                                if (fetchAttempt++ > 5)
                                    clearInterval(fetchPoll);
                            })
                            .catch(e => {
                                if (fetchAttempt++ > 5) {
                                    process.exit(1);
                                }
                            });
                    }, 1000);
                });
            } catch (e) {
                console.warn(chalk.yellow('WARNING: Docker not found. If this is Windows or MacOS, only tests that do not require docker will be run. See linux for all tests.'));
                console.warn(e);
                process.exit(0);
            }
        });
    }

    async teardown() {
        await new Promise((resolve, reject) => {
            try {
                crossSpawn.sync(`docker stop ${this.global.__DOCKER_CONTAINER__}`, { stdio: 'inherit' });
                resolve();
            } catch (e) {
                console.error(e);
                reject(e);
            }
        });
        await super.teardown();
        console.error('END');
    }

    runScript(script) {
        return super.runScript(script);
    }
}

module.exports = CustomEnvironment;