const fs = require('fs');
const https = require('https');
const mongodb = require('mongodb');

const Database = require('./database');
const Filebase = require('./filebase');

class Server {
  constructor(environmentConfigVariable) {
    if (!process.env[environmentConfigVariable]) {
      throw Error(`The ${environmentConfigVariable} environment variable must be set to your config file`);
    }
    const configFile = fs.readFileSync(process.env[environmentConfigVariable]);
    this.config = JSON.parse(configFile);
  }

  async start() {
    const serverConfig = this.getServerConfig();
    const db = await mongodb.MongoClient.connect(this.config.database.mongo_url);

    this.database = new Database(db, mongodb.ObjectId, this.config);
    this.filebase = new Filebase(this.config, this.database);

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
