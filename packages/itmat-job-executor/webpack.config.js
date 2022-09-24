const getWebpackConfig = (config) => {

    config.entry.executor = config.entry.main;

    return config;
};

module.exports = getWebpackConfig;
