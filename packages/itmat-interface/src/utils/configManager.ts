import path from 'path';
import { ConfigurationManager } from '@itmat-broker/itmat-cores';

export default ConfigurationManager.expand((process.env['NODE_ENV'] === 'development' ? [path.join(__dirname.replace('dist', ''), 'config/config.json')] : []).concat(['config/config.json']));
