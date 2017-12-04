const fs = require('fs');
const https = require('https');

const Database = require('./database');
const FileStorage = require('./file-storage');

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

    this.database = await Database.create(this.config);
    this.fileStorage = await FileStorage.create(this.config, this.database);

    const app = await this.createApplication(this.config, this.database, this.fileStorage);

    const serverOptions = {
      key: fs.readFileSync(this.config.server.key_file),
      cert: fs.readFileSync(this.config.server.certificate_file),
    };

    return https.createServer(serverOptions, app)
      .listen(serverConfig.port);
  }
}

module.exports = Server;
