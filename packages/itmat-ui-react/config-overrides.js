const webpack = require('webpack');

module.exports = function override(config) {
    config.resolve.fallback = {
        crypto: false,
        fs: false,
        http: false,
        https: false,
        path: false,
        stream: false,
        timers: false
    };
    config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/minio/, `${__dirname}/src/utils/noop`)
    );
    return config;
};
