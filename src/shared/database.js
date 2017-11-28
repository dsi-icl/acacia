class Database {
  constructor(db, ObjectId, config) {
    this.db = db;
    this.ObjectId = ObjectId;
    this.appCollection = db.collection(config.database.applications_collection);
    this.logCollection = db.collection(config.database.access_log_collection);
  }

  async logFileAccess(username, filename) {
    const logEntry = { user: username, file: filename };
    await this.logCollection.insert(logEntry);
  }

  async logDataAccess(username, application, key) {
    const logEntry = { user: username, application: new this.ObjectId(application), key };
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
}

module.exports = Database;
