const webpack = require('webpack');

module.exports = function override(config) {
    config.resolve.fallback = {
        fs: false,
        http: false,
        https: false,
        stream: false,
        crypto: false,
        timers: false,
        path: false
    };
    config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/minio/, `${__dirname}/src/utils/noop`)
    );
    return config;
};
