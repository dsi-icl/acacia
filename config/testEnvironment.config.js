const fetch = require('node-fetch');
const crossSpawn = require('cross-spawn');
let chalk = require('chalk');
const { choosePort } = require('react-dev-utils/WebpackDevServerUtils');

const isSupportedDocker = process.env.CI === undefined || (process.env.CI !== undefined && !(process.platform === 'darwin' || process.platform === 'win32'));

module.exports = {
    minioContainerSetup: (container, port) => {
        if (!isSupportedDocker)
            console.warn(chalk.yellow('WARNING: Docker not found. If this is Windows or MacOS, only tests that do not require docker will be run. See linux for all tests.'));
        return new Promise((resolve) => {
            try {
                choosePort('localhost', port).then((port) => {
                    if (port === null) {
                        console.error(chalk.red('No port could be selected to bring up the container.'));
                        process.exit(1);
                    }
                    crossSpawn.sync('docker --version', { stdio: 'inherit' });
                    crossSpawn.sync('docker pull "minio/minio:latest"');
                    const minioProcess = crossSpawn('docker', [
                        'run', '--rm',
                        '--name', `${container}`,
                        '-p', `${port}:9000`,
                        'minio/minio:latest',
                        'server', '/data'
                    ]);
                    minioProcess.on('error', (error) => {
                        throw new Error(error.message);
                    });
                    minioProcess.on('exit', (code, signal) => {
                        if (code !== 0) {
                            console.error(chalk.red(`Container failed with code ${code} and signal '${signal}'`));
                            if (!isSupportedDocker)
                                process.exit(0);
                            else
                                process.exit(code);
                        }
                    });
                    let fetchAttempt = 0;
                    const fetchPoll = setInterval(() => {
                        fetch(`http://localhost:${port}`)
                            .then(res => {
                                if (res.status === 403) {
                                    clearInterval(fetchPoll);
                                    console.log(chalk.green('Docker Minio has started up.'));
                                    resolve(port);
                                } else {
                                    console.error(chalk.red(`Unexpected server status ${res.status}`));
                                    crossSpawn.sync(`docker stop "${container}"`, { stdio: 'inherit' });
                                    if (!isSupportedDocker)
                                        process.exit(0);
                                    else
                                        process.exit(1);
                                }
                                if (fetchAttempt++ > 5)
                                    clearInterval(fetchPoll);
                            })
                            .catch(() => {
                                if (fetchAttempt++ > 5) {
                                    if (!isSupportedDocker)
                                        process.exit(0);
                                    else
                                        process.exit(1);
                                }
                            });
                    }, 1000);
                });
            } catch (e) {
                console.warn(e);
                process.exit(0);
            }
        });
    },

    minioContainerTeardown: (container) => {
        return new Promise((resolve, reject) => {
            try {
                crossSpawn.sync(`docker stop ${container}`, { stdio: 'inherit' });
                resolve();
            } catch (e) {
                console.error(e);
                reject(e);
            }
        });
    }
};