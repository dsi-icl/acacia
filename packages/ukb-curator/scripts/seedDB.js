'use strict';
const fs = require('fs');
const process = require('process');
const Papa = require('papaparse');
const mongo = require('mongodb');

if (!process.argv[6] || !(process.argv[6] === 'codes' || process.argv[6] === 'fields')) {
    console.log('usage: node script.js filepath mongoURL database collection codes|fields');
    process.exit(1);
}

async function main() {
    const conn = await mongo.MongoClient.connect(process.argv[3], { useNewUrlParser: true });
    const db = conn.db(process.argv[4]);
    let collection = db.collection(process.argv[5]);
    await collection.drop();
    await db.createCollection(process.argv[5]);
    collection = db.collection(process.argv[5]);
    const index = process.argv[6] === 'fields' ? { FieldID: 1 } : { Coding: 1, Value: 1 };
    await collection.createIndex(index, { unique: true });

    const readStream = fs.createReadStream(process.argv[2]);

    const parseOptions = {
        delimiter: ',',
        quoteChar: '"',
        header: true,
        trimHeaders: true,
        transform: process.argv[6] === 'fields' ? undefined : (value, col) => {
            if (col === 'Coding') {
                return parseInt(value, 10);
            } else {
                return value;
            }
        },
        dynamicTyping: process.argv[6] === 'fields' ? true : false,
        encoding: 'utf-8',
    };

    const parseStream = readStream.pipe(Papa.parse(Papa.NODE_STREAM_INPUT, parseOptions));

    const promises = [];
    let lineNum = 1;
    parseStream.on('data', line => {
        console.log('number of line', lineNum);
        promises.push(collection.insertOne(line).catch(err => console.log('error on this line', line, err)));
        lineNum++;
    });

    parseStream.on('end', () => {
        Promise.all(promises).then(() => {
            console.log('success');
            conn.close();
        });
    });
};

main();
