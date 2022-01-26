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
    return config;
};
