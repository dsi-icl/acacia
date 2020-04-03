module.exports = (config) => {
    config.set({
        mutate: [
            '{src,lib}/**/*.[jt]s?(x)',
            '!{src,lib}/**/?(*.)+(spec|test).[jt]s?(x)',
        ],
        mutator: 'typescript',
        packageManager: 'yarn',
        reporters: ['html', 'clear-text', 'progress', 'dashboard'],
        testRunner: 'jest',
        coverageAnalysis: 'off',
        maxConcurrentTestRunners: 4,
        timeoutMS: 30000,
        jest: {
            enableFindRelatedTests: false
        },
        dashboard: {
            reportType: 'full'
        }
    });
};