const os2 = require('os2');

class Filebase {
  constructor(account, config, database) {
    this.config = config;
    this.database = database;
    this.account = account;
  }

  async requestFile(username, filename) {
    const canUserAccessFile = await this.database.canUserAccessFile(username, filename);
    if (!canUserAccessFile) return null;
    await this.database.logFileAccess(username, filename);
    const container = new os2.Container(this.account, 'files');
    const segment = new os2.Segment(container, filename);
    const stream = await segment.getContentStream();
    return stream;
  }
}

module.exports = Filebase;
