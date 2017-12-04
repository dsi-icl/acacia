const os2 = require('os2');

/**
 * Class providing all file-storage-related functionality.
 */
class FileStorage {
  /**
   * Constructor of FileStorage.
   * @param {Object} account - The account associated to the object storage.
   * @param {Object} config - The object including the configuration of the server.
   * @param {Object} database - The currently active database.
   */
  constructor(account, config, database) {
    this.config = config;
    this.database = database;
    this.account = account;
    this.container = new os2.Container(this.account, this.config.file_storage.container);
  }

  /**
   * Check if the user can access the file, log the action, and return the object segment.
   * @private
   * @async
   * @param {string} username - The name of the user.
   * @param {string} filename - The name of the file.
   * @returns {Segment} The segment of the file in the object storage or null.
   */
  async requestObjectSegment(username, filename) {
    const canUserAccessFile = await this.database.canUserAccessFile(username, filename);
    if (!canUserAccessFile) return null;
    await this.database.logFileAccess(username, filename);
    const segment = new os2.Segment(this.container, filename);
    return segment;
  }

  /**
   * Check if the user can access the file, log the action, and return a stream to the file.
   * @async
   * @param {string} username - The name of the user.
   * @param {string} filename - The name of the file.
   * @returns {MemoryStream} The stream to the data of the file.
   */
  async requestFileContent(username, filename) {
    const segment = await this.requestObjectSegment(username, filename);
    if (!segment) return null;
    const stream = await segment.getContentStream();
    return stream;
  }

  /**
   * Check if the user can access the file, log the action, and return the file public metadata.
   * @async
   * @param {string} username - The name of the user.
   * @param {string} filename - The name of the file.
   * @returns {Object} The public metadata of the file.
   */
  async requestPublicMetadata(username, filename) {
    const segment = await this.requestObjectSegment(username, filename);
    if (!segment) return null;
    const metadata = await segment.getMetadata();
    return metadata;
  }
}

module.exports = FileStorage;
