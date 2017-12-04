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
  }

  /**
   * Check if the user can access the file, log the action, and return a stream to the file.
   * @async
   * @param {string} username - The name of the user.
   * @param {string} filename - The name of the file.
   * @returns {MemoryStream} The stream to the data of the file.
   */
  async requestFile(username, filename) {
    const canUserAccessFile = await this.database.canUserAccessFile(username, filename);
    if (!canUserAccessFile) return null;
    await this.database.logFileAccess(username, filename);
    const container = new os2.Container(this.account, this.config.file_storage.container);
    const segment = new os2.Segment(container, filename);
    const stream = await segment.getContentStream();
    return stream;
  }
}

module.exports = FileStorage;
