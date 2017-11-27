const mongodb = require('mongodb');
const fs = require('fs');
const byline = require('byline');

if (process.argv.length !== 5) {
  // eslint-disable-next-line no-console
  console.log(`usage: ${process.argv[1]} <database_url> <collection> <file>`);
  process.exit(1);
}

let headers = null;
let firstLine = true;

const dbconnector = mongodb.MongoClient.connect(process.argv[2]);
const stream = byline(fs.createReadStream(process.argv[4], { encoding: 'utf8' }));

stream.on('data', (line) => {
  if (firstLine) {
    headers = line.replace(/\./g, '_').split('\t');
    firstLine = false;
  } else {
    const values = line.split('\t');
    const object = {};
    for (let i = 0; i < values.length; i += 1) {
      if (values[i].length > 0) {
        object[headers[i]] = (i === 0 ? parseInt(values[i], 10) : values[i]);
      }
    }
    dbconnector.then(db => db.collection(process.argv[3]).insert(object))
    // eslint-disable-next-line no-console
      .catch(error => console.log(`${error.name}: ${error.message}`));
  }
});

stream.on('end', () => {
  dbconnector.then((db) => {
    db.collection(process.argv[3]).ensureIndex({ eid: 1 }, { unique: true })
      .then(() => db.close());
  });
});
