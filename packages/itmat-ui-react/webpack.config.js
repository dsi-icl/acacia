const getNxReactWebpackConfig = require('@nrwl/react/plugins/webpack');
const webpack = require('webpack');
const git = require('git-rev-sync');
const { version } = require('../../package.json');

const getWebpackConfig = (config, { options }) => {

    const webpackConfig = getNxReactWebpackConfig(config);
    const baseHref = options?.baseHref ?? '/';

    // Usage of server modules in `itmat-commons` requires us to explicitly set fallbacks
    // Investigate spliting the `itmat-commons` package
    webpackConfig.resolve.fallback = {
        minio: false,
        crypto: false,
        path: false,
        fs: false,
        http: false,
        https: false,
        timers: false,
        stream: require.resolve('stream-browserify')
    };

    webpackConfig.plugins.splice(0, 0, new webpack.EnvironmentPlugin({
        NX_REACT_APP_VERSION: version,
        NX_REACT_APP_COMMIT: git.short(),
        NX_REACT_APP_BRANCH: git.branch(),
        NX_REACT_APP_BASEHREF: baseHref
    }));

    webpackConfig.plugins.splice(0, 0, new webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer']
    }));

    return webpackConfig;
};

module.exports = getWebpackConfig;
