const fs = require('fs');
const https = require('https');
const mongodb = require('mongodb');
const os2 = require('os2');

const Database = require('./database');
const Filebase = require('./file-storage');
const Utils = require('./utils');

/**
 * Class representing an abstract server and managing logic shared by the client and the API.
 */
class Server {
  /**
   * Abstract constructor of Server. Only should be called from a class extending Server.
   * @param {Object} config - The object including the configuration of the server.
   */
  constructor(config) {
    this.config = config;
  }

  /**
   * Starts the server.
   * @async
   */
  async start() {
    const serverConfig = this.getServerConfig();
    let db;
    try {
      db = await mongodb.MongoClient.connect(this.config.database.mongo_url);
    } catch (error) { Utils.fatalError(error.message); }
    this.database = new Database(db, mongodb.ObjectId, this.config);

    let account;
    try {
      const store = new os2.Store(this.config.file_storage.swift_url);
      account = new os2.Account(store, this.config.file_storage.user, this.config.file_storage.key);
      await account.connect();
    } catch (error) { Utils.fatalError(error.message); }

    this.filebase = new Filebase(account, this.config, this.database);

    const app = await this.createApplication(this.config, this.database, this.filebase);

    const serverOptions = {
      key: fs.readFileSync(this.config.server.key_file),
      cert: fs.readFileSync(this.config.server.certificate_file),
    };

    return https.createServer(serverOptions, app)
      .listen(serverConfig.port);
  }
}

module.exports = Server;
