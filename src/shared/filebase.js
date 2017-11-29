const request = require('request');

class Filebase {
  constructor(config, database) {
    this.config = config;
    this.database = database;
  }

  async requestFile(username, filename) {
    const canUserAccessFile = await this.database.canUserAccessFile(username, filename);
    if (!canUserAccessFile) return null;
    await this.database.logFileAccess(username, filename);
    const file = await request(this.config.file_storage.swift_url + filename);
    return file;
  }
}

module.exports = Filebase;
