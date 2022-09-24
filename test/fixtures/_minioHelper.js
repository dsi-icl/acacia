const importDependencies = async () => {
    const fetch = (await import('node-fetch')).default;
    const crossSpawn = (await import('cross-spawn')).default;
    const getPort = (await import('get-port')).default;
    const { v4: uuid } = await import('uuid');
    const chalk = (await import('chalk')).default;
    return { fetch, crossSpawn, getPort, uuid, chalk };
}
// const MINIO_DOCKER_VERSION = '@sha256:4a1bbd112c0c09fc3a07ae84f5e5a4501dbc7bf8d637a5ddd0df76a425630043';
const MINIO_DOCKER_VERSION = ':latest';
const minioHelpers = {
    minioContainerSetup: async (container, port) => {
        return new Promise(async (resolve, reject) => {
            const { chalk, crossSpawn, fetch, getPort, uuid } = await importDependencies();
            try {
                getPort({ port }).then((_port) => {
                    const _container = container ?? uuid();
                    crossSpawn.sync('docker', ['--version'], { stdio: 'inherit' });
                    const result = crossSpawn.sync('docker', ['pull', `minio/minio${MINIO_DOCKER_VERSION}`], { stdio: 'inherit' });
                    if (result.error) {
                        console.warn(chalk.bgYellowBright(chalk.black(' WARNING ')), chalk.yellow('We coult not execute docker. Some tests will not be run.'));
                        return reject();
                    }
                    console.log(`Bringing Container on port ${_port}...`);
                    const minioProcess = crossSpawn('docker', [
                        'run', '--rm',
                        '--name', `${_container}`,
                        '-p', `${_port}:9000`,
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
                        fetch(`http://localhost:${_port}`)
                            .then(res => {
                                if (res.status === 403) {
                                    clearInterval(fetchPoll);
                                    console.log(chalk.green('Docker Minio has started up.'));
                                    resolve([_container, _port]);
                                } else {
                                    console.error(chalk.red(`Unexpected server status ${res.status}. Will try ${5 - fetchAttempt} more time(s).`));
                                    if (fetchAttempt > 5) {
                                        console.error(chalk.bgRedBright(chalk.black(' ERROR ')), chalk.yellow('We could not bring up the server.'));
                                        crossSpawn.sync('docker', ['stop', `${_container}`], { stdio: 'inherit' });
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
                console.error(chalk.bgYellowBright(chalk.black(' ERROR ')), chalk.yellow('An error occurred while trying to execute docker.'));
                console.error(e.message);
                return reject();
            }
        });
    },
    minioContainerTeardown: (container) => {
        return new Promise(async (resolve, reject) => {
            const { chalk, crossSpawn, fetch, getPort, uuid } = await importDependencies();
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

module.exports = minioHelpers;
