const mongodb = require('mongodb');
const fs = require('fs');
const Papa = require('papaparse');

if (process.argv.length !== 6) {
    // eslint-disable-next-line no-console
    console.log(`usage: ${process.argv[1]} <database_url> <collection> <file> <"data"/"dictionary"/"coding">`);
    process.exit(1);
}

const dbconnector = mongodb.MongoClient.connect(process.argv[2]);

const parserOptions = {
    quoteChar: '"',
    header: true,
    trimHeaders: true,
    complete: () => { console.log('Successful'); dbconnector.then(db => db.close()); }, // eslint-disable-line no-console
    error: err => { console.error(err); }, // eslint-disable-line no-console
};

switch (process.argv[5]) {
    case 'dictionary':
    case 'coding':
        parserOptions.step = results => {
            const entry = results.data[0];
            dbconnector.then(db => db.collection(process.argv[3]).insert(entry))
                // eslint-disable-next-line no-console
                .catch(error => console.log(`${error.name}: ${error.message}`));
        };
        break;
    case 'data':
        parserOptions.step = results => {
            const entry = results.data[0];
            Object.keys(entry).forEach(el => {
                if (entry[el] === '') {
                    delete entry[el];
                }
            });
            dbconnector.then(db => db.collection(process.argv[3]).insert(entry))
            // eslint-disable-next-line no-console
                .catch(error => console.log(`${error.name}: ${error.message}`));
        };
        break;
}

const stream = fs.createReadStream(process.argv[4], { encoding: 'utf8' });

Papa.parse(stream, parserOptions);