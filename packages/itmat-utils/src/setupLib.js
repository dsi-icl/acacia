module.exports = (baseConfiguration) => {
    baseConfiguration.output.globalObject = 'this';
    baseConfiguration.output.filename = 'itmatUtils.umd.js';
    return baseConfiguration;
};