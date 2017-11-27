const fs = require('fs');

const Server = require('./server');

const configPath = (process.argv.length > 2) ? process.argv[2] : 'config.json';
const configFile = fs.readFileSync(configPath);
const configValues = JSON.parse(configFile);

const server = new Server(configValues);

module.exports = server.start(); // for testing
