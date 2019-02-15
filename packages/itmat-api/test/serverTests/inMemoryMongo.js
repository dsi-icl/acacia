const { MongoMemoryServer } = require('mongodb-memory-server');
 
const mongod = new MongoMemoryServer();

module.exports = mongod;