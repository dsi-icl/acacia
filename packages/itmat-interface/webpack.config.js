const getWebpackConfig = (config) => {

    config.entry.interface = config.entry.main;

    return config;
};

module.exports = getWebpackConfig;
