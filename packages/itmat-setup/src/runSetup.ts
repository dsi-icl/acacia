import { setupDatabase } from './index';
import config from '../config/config.json';
import chalk from 'chalk';

setupDatabase(config.database.mongo_url, config.database.database)
    .then(() => {
        console.log(chalk.green('[[SUCCESS]]: Finsihed setting up the mongo database.'));
    })
    .catch(e => {
        console.log(chalk.red(`[[ERROR]]: ${e.toString()}`));
    });
