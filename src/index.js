const fs = require('fs');

const Server = require('./server');

const configFile = fs.readFileSync('config.json');
const configValues = JSON.parse(configFile);

const server = new Server(configValues);

module.exports = server.start(); // for testing
