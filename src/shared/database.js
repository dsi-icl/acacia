const jwt = require('jsonwebtoken');
const uuid = require('uuid/v4');

class Database {
  constructor(db, ObjectId, config) {
    this.config = config;
    this.db = db;
    this.ObjectId = ObjectId;
    this.appCollection = db.collection(config.database.applications_collection);
    this.logCollection = db.collection(config.database.access_log_collection);
    this.tokenCollection = db.collection(config.database.token_collection);

    this.tokenCollection.createIndex(
      { tokenId: 1, username: 1 },
      { expireAfterSeconds: config.database.token_duration_seconds, unique: true },
    );
  }

  async logFileAccess(username, filename) {
    const logEntry = { user: username, file: filename, date: new Date() };
    await this.logCollection.insert(logEntry);
  }

  async logDataAccess(username, application, key) {
    const logEntry = { user: username, application: new this.ObjectId(application),
      key: key, date: new Date() };
    await this.logCollection.insert(logEntry);
  }

  async canUserAccessFile(username, filename) {
    const query = { users: username, files: filename };
    const applicationCount = await this.appCollection.find(query).count();
    return applicationCount > 0;
  }

  async getUserApplications(username) {
    const query = { users: username };
    const applications = await this.appCollection.find(query, { users: 0 }).toArray();
    return applications;
  }

  async getCursorToData(username, applicationID, dataKey) {
    const application = await this.appCollection
      .findOne({ _id: new this.ObjectId(applicationID), users: username });
    const dataCursor = await this.db.collection(application.data[dataKey].collection)
      .find(
        { eid: { $in: application.data[dataKey].documents } },
        Object.assign({ _id: 0 }, ...application.data[dataKey].fields.map(i => ({ [i]: 1 }))),
      );
    return dataCursor;
  }

  async requestDataset(username, application, key) {
    await this.logDataAccess(username, application, key);
    const data = await this.getCursorToData(username, application, key);
    return data;
  }

  async regenerateToken(username) {
    const tokenId = uuid();
    await this.tokenCollection
      .update({ username }, { tokenId, username }, { upsert: true });
    const token = jwt.sign(
      { tokenId, username }, this.config.api.token_secret,
      { expiresIn: this.config.database.token_duration_seconds },
    );
    return token;
  }

  async consumeTokenAndGetUsername(token) {
    const payload = jwt.verify(token, this.config.api.token_secret);
    const removeResult = await this.tokenCollection
      .deleteOne({ tokenId: payload.tokenId, username: payload.username });
    if (removeResult.deletedCount !== 0) {
      return payload.username;
    }
    return null;
  }

  async invalidateTokenByUsername(username) {
    this.tokenCollection.deleteOne({ username });
  }
}

module.exports = Database;
