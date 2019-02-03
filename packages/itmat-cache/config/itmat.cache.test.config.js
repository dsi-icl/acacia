const {Constants}  =  require('eae-utils');

module.exports = {
    mongoURL: 'mongodb://jean:root@146.169.33.32:27020/eaeservices',
    port: 800,
	enableCors: true,
    swiftURL: 'https://swift-bench.dsi.ic.ac.uk',
    swiftUsername: 'test:tester',
    swiftPassword: 'testing',
    computeType: [Constants.EAE_COMPUTE_TYPE_PYTHON2],
    clusters:{}
};
