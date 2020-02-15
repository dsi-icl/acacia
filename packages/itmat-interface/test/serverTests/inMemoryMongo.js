const { MongoMemoryServer } = require('mongodb-memory-server');
const config = require('./config');
 
const mongodb = new MongoMemoryServer();

/* Creating a in-memory MongoDB instance for testing */
const getConnectionString = mongodb.getUri.bind(mongodb);
const getDatabaseName = mongodb.getDbName.bind(mongodb);

module.exports = { getConnectionString, getDatabaseName, mongodb };