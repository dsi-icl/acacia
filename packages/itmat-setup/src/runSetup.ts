import { setupDatabase } from './index';
import chalk from 'chalk';
import fs from 'fs';

const content = fs.readFileSync('../config/config.json', 'utf-8');
let config;
try {
    config = JSON.parse(content);
} catch (e) {
    console.error(chalk.red('Cannot parse configuration file.'));
}

setupDatabase(config.database.mongo_url, config.database.database)
    .then(() => {
        console.log(chalk.green('[[SUCCESS]]: Finsihed setting up the mongo database.'));
    })
    .catch(e => {
        console.log(chalk.red(`[[ERROR]]: ${e.toString()}`));
    });
