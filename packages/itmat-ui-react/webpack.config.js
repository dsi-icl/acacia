const webpack = require('webpack');
const { composePlugins, withNx } = require('@nx/webpack');
const { withReact } = require('@nx/react');
const git = require('git-rev-sync');
const { version } = require('../../package.json');

module.exports = composePlugins(
    withNx(),
    withReact(),
    (config, context) => {

        config.resolve.alias = {
            fs: 'empty',
            http: require.resolve('stream-http'),
            https: require.resolve('https-browserify'),
            url: require.resolve('url/'),
            path: require.resolve('path-browserify'),
            stream: require.resolve('stream-browserify')
        };

        config.externals = function (context, request, callback) {
            const externals = {
                'fs': 'empty',
                'stream-http': 'stream-http',
                'https-browserify': 'https-browserify',
                'url/': 'url',
                'path-browserify': 'path-browserify',
                'stream-browserify': 'stream-browserify'
            };

            if (externals[request]) {
                return callback(null, `commonjs ${externals[request]}`);
            }
            callback();
        };

        const baseHref = context?.options?.baseHref ?? '/';

        config.plugins.splice(0, 0, new webpack.EnvironmentPlugin({
            NX_REACT_APP_VERSION: version,
            NX_REACT_APP_COMMIT: git.short(),
            NX_REACT_APP_BRANCH: git.branch(),
            NX_REACT_APP_BASEHREF: baseHref
        }));

        config.plugins.splice(0, 0, new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer']
        }));

        return config;
    }
);