module.exports = (baseConfiguration) => {
    baseConfiguration.output.globalObject = 'this';
    baseConfiguration.output.filename = 'itmatCommon.umd.js';
    return baseConfiguration;
};