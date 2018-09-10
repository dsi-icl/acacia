const fs = require('fs');

const ApiServer = require('./server');

const environmentConfigVariable = 'ITMAT_CONFIG';
if (!process.env[environmentConfigVariable]) {
    throw Error(`The ${environmentConfigVariable} environment variable must be set as the path to your config file.`);
}

const configFile = fs.readFileSync(process.env[environmentConfigVariable]);
const config = JSON.parse(configFile);

const server = new ApiServer(config);
console.log('server starting here', server.start);
server.start();
