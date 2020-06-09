const fetch = require('node-fetch');
const crossSpawn = require('cross-spawn');
const getPort = require('get-port');
const { v4: uuid } = require('uuid');
const chalk = require('chalk');

module.exports = {
    minioContainerSetup: (container, port) => {
        return new Promise((resolve, reject) => {
            try {
                getPort(port).then((port) => {
                    if (container === undefined)
                        container = uuid();
                    crossSpawn.sync('docker', ['--version'], { stdio: 'inherit' });
                    const result = crossSpawn.sync('docker', ['pull', 'minio/minio:latest'], { stdio: 'inherit' });
                    if (result.error) {
                        console.warn(chalk.bgYellowBright(chalk.black(' WARNING ')), chalk.yellow('We coult not execute docker. Some tests will not be run.'));
                        return reject();
                    }
                    console.log(`Bringing Container on port ${port}...`);
                    const minioProcess = crossSpawn('docker', [
                        'run', '--rm',
                        '--name', `${container}`,
                        '-p', `${port}:9000`,
                        'minio/minio:latest',
                        'server', '/data'
                    ], { stdio: 'inherit' });
                    minioProcess.on('error', (error) => {
                        throw new Error(error.message);
                    });
                    minioProcess.on('exit', (code, signal) => {
                        if (code !== 0) {
                            console.error(chalk.red(`Container failed with code ${code} and signal '${signal}'`));
                            return reject();
                        }
                    });
                    let fetchAttempt = 0;
                    const fetchPoll = setInterval(() => {
                        fetch(`http://localhost:${port}`)
                            .then(res => {
                                if (res.status === 403) {
                                    clearInterval(fetchPoll);
                                    console.log(chalk.green('Docker Minio has started up.'));
                                    resolve([container, port]);
                                } else {
                                    console.error(chalk.red(`Unexpected server status ${res.status}. Will try ${5 - fetchAttempt} more time(s).`));
                                    if (fetchAttempt > 5) {
                                        console.error(chalk.bgRedBright(chalk.black(' ERROR ')), chalk.yellow('We could not bring up the server.'));
                                        crossSpawn.sync('docker', ['stop', `${container}`], { stdio: 'inherit' });
                                        return reject();
                                    }
                                }
                                if (fetchAttempt++ > 5)
                                    clearInterval(fetchPoll);
                            })
                            .catch(() => {
                                if (fetchAttempt++ > 5)
                                    return reject();
                            });
                    }, 1000);
                });
            } catch (e) {
                console.error(chalk.bgYellowBright(chalk.black(' WARNING ')), chalk.yellow('An error occurred while trying to execute docker.'));
                console.error(e.message);
                return reject();
            }
        });
    },

    minioContainerTeardown: (container) => {
        return new Promise((resolve, reject) => {
            try {
                crossSpawn.sync('docker', ['stop', `${container}`], { stdio: 'inherit' });
                resolve();
            } catch (e) {
                console.error(e);
                reject(e);
            }
        });
    }
};
