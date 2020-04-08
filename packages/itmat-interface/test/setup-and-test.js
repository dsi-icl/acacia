const fetch = require('node-fetch');
const child_process = require('child_process');
let chalk = require('chalk');
chalk = new chalk.Instance({level: 1});

const MINIO_PORT = 8080;

try {
    child_process.execSync('docker --version', {stdio: 'inherit'});
    child_process.execSync('docker pull minio/minio:latest', { stdio: 'inherit'});
} catch (e) {
    if (process.platform === 'darwin' || process.platform === 'win32') {
        console.log(chalk.yellow('WARNING: Docker not found. If this is Windows or MacOS, only tests that do not require docker will be run. See linux for all tests.'));
        child_process.execSync('npm run jest --color --coverage ./test/serverTests/job.test.ts ./test/serverTests/permission.test.ts ./test/serverTests/study.test.ts ./test/serverTests/users.test.ts ./test/unitTests/permissionCore.test.ts', { stdio: 'inherit' });
        process.exit(0);
    }
    console.error(chalk.red('ERROR SETTING UP TESTS: Docker not found. Object store integration tests require docker.'));
    console.error(e);
    process.exit(1);
}

let minio;
try {
    minio = child_process.exec(`docker run --name interface-minio --rm -p ${MINIO_PORT}:9000 minio/minio server /data`);
} catch (e) {
    console.error(e);
    child_process.execSync('docker stop interface-minio', { stdio: 'inherit' });
    process.exit(1);
}

const timeout = setTimeout(() => {
    child_process.execSync('docker stop interface-minio', { stdio: 'inherit' });
    process.exit(1);
}, 1000 * 60 * 5 /* 5 min */);

const fetchpoll = setInterval(() => {
    fetch(`http://localhost:${MINIO_PORT}`)
        .then(res => {
            if (res.status === 403) {
                clearInterval(fetchpoll);
                clearTimeout(timeout);
                console.log(chalk.yellow('Docker minio has started up. Running tests now.'));
                child_process.execSync('yarn test-files', { stdio: 'inherit' });
                child_process.execSync('docker stop interface-minio', { stdio: 'inherit' });
            } else {
                console.error(`Unexpected res status ${res.status}`);
                child_process.execSync('docker stop interface-minio', { stdio: 'inherit' });
                process.exit(1);
            }
        })
        .catch(e => {
            if (e.message === `request to http://localhost:${MINIO_PORT}/ failed, reason: connect ECONNREFUSED 127.0.0.1:${MINIO_PORT}`) {
                console.log(chalk.blue('Fetch: Waiting for server to be set up.'));
            } else {
                console.error(chalk.red('ERROR:'));
                console.log(e);
                child_process.execSync('docker stop interface-minio', { stdio: 'inherit' });
                process.exit(1);
            }
        });
}, 5000);
