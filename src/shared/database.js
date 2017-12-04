const mongodb = require('mongodb');
const util = require('util');
const jwt = require('jsonwebtoken');
const uuid = require('uuid/v4');

const Utils = require('./utils');

const ObjectId = mongodb.ObjectId;

/**
 * Class providing all database-related functionality.
 */
class Database {
  /**
   * Create a Database instance.
   * @static
   * @async
   * @param {Object} config - The object including the configuration of the server.
   * @returns {Database} The Database instances.
   */
  static async create(config){
    let db;
    try {
      db = await mongodb.MongoClient.connect(config.database.mongo_url);
    } catch (error) { Utils.fatalError(error.message); }
    return new Database(db, config);
  }

  /**
   * Constructor of Database.
   * @private
   * @param {Object} db - The mongodb object.
   * @param {Object} config - The object including the configuration of the server.
   */
  constructor(db, config) {
    this.config = config;
    this.db = db;
    this.appCollection = db.collection(config.database.applications_collection);
    this.logCollection = db.collection(config.database.access_log_collection);
    this.tokenCollection = db.collection(config.database.token_collection);
    this.errorCollection = db.collection(config.database.errors_collection);

    this.tokenCollection.createIndex(
      { tokenId: 1, username: 1 },
      { expireAfterSeconds: config.database.token_duration_seconds, unique: true },
    );
  }

  /**
   * Add an entry to the file access log.
   * @async
   * @param {string} username - The name of the user.
   * @param {string} filename - The name of the file.
   */
  async logFileAccess(username, filename) {
    const logEntry = { user: username, file: filename, date: new Date() };
    await this.logCollection.insert(logEntry);
  }

  /**
   * Add an entry to the data access log.
   * @async
   * @param {string} username - The name of the user.
   * @param {string} application - The indentifier of the application.
   * @param {string} key - The key of the datase within the application.
   */
  async logDataAccess(username, application, key) {
    const logEntry = {
      user: username,
      application: new ObjectId(application),
      key,
      date: new Date(),
    };
    await this.logCollection.insert(logEntry);
  }

  /**
   * Add an entry to the internal server error log.
   * @async
   * @param {Object} error - The object thrown by the error.
   * @param {Object} request - The request object.
   */
  async logInternalServerError(error, request) {
    const logEntry = { error: error.toString(),
      url: request.originalUrl,
      params: request.params,
      query: request.query,
      body: request.body
    };
    await this.errorCollection.insert(logEntry);
  }

  /**
   * Check if user can access a file.
   * @async
   * @param {string} username - The name of the user.
   * @param {string} filename - The name of the file.
   * @returns {boolean} True if the user has permissions to access the file, False otherwise.
   */
  async canUserAccessFile(username, filename) {
    const query = { users: username, files: filename };
    const applicationCount = await this.appCollection.find(query).count();
    return applicationCount > 0;
  }

  /**
   * Get all user applications.
   * @async
   * @param {string} username - The name of the user.
   * @returns {Array} The list of applications for the user.
   */
  async getUserApplications(username) {
    const query = { users: username };
    const applications = await this.appCollection.find(query, { users: 0 }).toArray();
    return applications;
  }

  /**
   * Log access and return a cursor to a dataset.
   * @async
   * @param {string} username - The name of the user.
   * @param {string} applicationID - The ID of the application.
   * @param {string} key - The key of the data within the application.
   * @returns {Cursor} The cursor to data.
   */
  async requestDataset(username, applicationID, key) {
    await this.logDataAccess(username, applicationID, key);
    const application = await this.appCollection
      .findOne({ _id: new ObjectId(applicationID), users: username });
    if (!application || !application.data[key]) return null;
    const dataCursor = await this.db.collection(application.data[key].collection)
      .find(
        { eid: { $in: application.data[key].documents } },
        Object.assign({ _id: 0 }, ...application.data[key].fields.map(i => ({ [i]: 1 }))),
      );
    return dataCursor;
  }

  /**
   * Regenerate the currently active access token for a given user.
   * @async
   * @param {string} username - The name of the user.
   * @returns {string} The generated token.
   */
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

  /**
   * Given a token, check if it is valid and active, then return the associated username.
   * @async
   * @param {string} token - The access token.
   * @returns {string} The name of the user if the token is valid and active, null otherwise.
   */
  async consumeTokenAndGetUsername(token) {
    let payload;
    try {
      payload = jwt.verify(token, this.config.api.token_secret);
    } catch (error) {
      return null;
    }
    const removeResult = await this.tokenCollection
      .deleteOne({ tokenId: payload.tokenId, username: payload.username });
    if (removeResult.deletedCount === 0) return null;
    return payload.username;
  }

  /**
   * Invalidate the currently active access token for a given user.
   * @async
   * @param {string} username - The name of the user.
   */
  async invalidateTokenByUsername(username) {
    this.tokenCollection.deleteOne({ username });
  }
}

module.exports = Database;
