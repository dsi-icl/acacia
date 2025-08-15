const path = require('node:path');
const webpack = require('webpack');
const { composePlugins, withNx } = require('@nx/webpack');
const git = require('git-rev-sync');
const { version } = require('../../package.json');

module.exports = composePlugins(
    withNx(),
    (config, context) => {

        config.entry.executor = [path.resolve(__dirname, 'src/jobExecutorRunner.ts')];

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

        const baseHref = context?.options?.baseHref ?? '/';

        config.plugins.splice(0, 0, new webpack.EnvironmentPlugin({
            NX_NODE_APP_VERSION: version,
            NX_NODE_APP_COMMIT: git.short(),
            NX_NODE_APP_BRANCH: git.branch(),
            NX_NODE_APP_BASEHREF: baseHref
        }));

        return config;
    }
);
