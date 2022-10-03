const path = require('node:path');

const getWebpackConfig = (config) => {

    config.entry.executor = [path.resolve(__dirname, 'src/jobExecutorServer.ts')];

    config.externals = [{
        'bcrypt': 'commonjs bcrypt',
        'express': 'commonjs express',
        'isobject': 'commonjs isobject',
        'minio': 'commonjs minio',
        'mongodb': 'commonjs mongodb',
        'bufferutil': 'commonjs bufferutil',
        'utf-8-validate': 'commonjs utf-8-validate',
        'require_optional': 'commonjs require_optional'
    }];

    return config;
};

module.exports = getWebpackConfig;
