import { setupDatabase } from './index';
import chalk from 'chalk';
import fs from 'fs';

let config;
try {
    const content = fs.readFileSync('./config.json', 'utf-8');
    config = JSON.parse(content);
} catch (e) {
    console.error(chalk.red('Cannot parse configuration file. Using default configuration.'));
    config = {
        database: {
            mongo_url: "mongodb://localhost:27017",
            database: "itmat"
        }
    }
}

setupDatabase(config.database.mongo_url, config.database.database)
    .then(() => {
        console.log(chalk.green('[[SUCCESS]]: Finsihed setting up the mongo database.'));
    })
    .catch(e => {
        console.log(chalk.red(`[[ERROR]]: ${e.toString()}`));
    });
