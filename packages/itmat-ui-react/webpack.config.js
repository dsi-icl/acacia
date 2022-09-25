const getNxReactWebpackConfig = require('@nrwl/react/plugins/webpack');
const webpack = require('webpack');
const git = require('git-rev-sync');
const { version } = require('../../package.json');

const getWebpackConfig = (config, { options }) => {

    const webpackConfig = getNxReactWebpackConfig(config);
    const baseHref = options?.baseHref ?? '/';

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
