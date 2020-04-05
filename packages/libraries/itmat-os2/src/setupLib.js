module.exports = (baseConfiguration) => {
    baseConfiguration.output.globalObject = 'this';
    baseConfiguration.output.filename = 'itmatOS2.umd.js';
    return baseConfiguration;
};