const fetch = require('node-fetch');
const child_process = require('child_process');
const chalk = require('chalk');

const MINIO_PORT = 8080;

try {
    child_process.execSync('docker --version', {stdio: 'inherit'});
} catch (e) {
    console.error('ERROR SETTING UP TESTS: Docker not found. Object store integration tests require docker.');
    console.error(e);
    process.exit(1);
}

let minio;
try {
    child_process.execSync('docker pull minio/minio:latest', { stdio: 'inherit'});
    minio = child_process.exec(`docker run --rm -p ${MINIO_PORT}:9000 minio/minio server /data`);
} catch (e) {
    console.error(e);
    if (minio) {
        minio.kill();
    }
    process.exit(1);
}

const fetchpoll = setInterval(() => {
    fetch(`http://localhost:${MINIO_PORT}`)
        .then(res => {
            if (res.status === 403) {
                clearInterval(fetchpoll);
                console.log(chalk.yellow('Docker minio has started up. Running tests now.'));
                child_process.execSync('yarn test-files', { stdio: 'inherit' });
                minio.kill();
            } else {
                console.error(`Unexpected res status ${res.status}`);
                minio.kill();
                process.exit(1);
            }
        })
        .catch(e => {
            if (e.message === `request to http://localhost:${MINIO_PORT}/ failed, reason: connect ECONNREFUSED 127.0.0.1:${MINIO_PORT}`) {
                console.log(chalk.blue('Fetch: Waiting for server to be set up.'));
            } else {
                console.error(chalk.red('ERROR:'));
                console.log(e);
                minio.kill();
                process.exit(1);
            }
        });
}, 5000);