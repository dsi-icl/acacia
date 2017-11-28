const request = require('request');

class Filebase {
  constructor(config, database) {
    this.config = config;
    this.database = database;
  }

  async requestFile(username, filename) {
    const canUserAccessFile = await this.database.canUserAccessFile(username, filename);
    if (canUserAccessFile) {
      await this.database.logFileAccess(username, filename);
      const file = await request(this.config.file_storage.swift_url + filename);
      return file;
    } throw Error('This user can not access this file');
  }
}

module.exports = Filebase;
