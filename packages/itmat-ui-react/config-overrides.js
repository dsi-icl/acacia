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
    return config;
};
