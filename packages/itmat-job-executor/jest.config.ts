/* eslint-disable */
export default {
    displayName: 'itmat-job-executor',
    preset: '../../jest.preset.cjs',
    testEnvironment: 'node',
    transform: {
        '^.+\\.[tj]s$': '@swc/jest'
    },
    moduleFileExtensions: ['ts', 'js', 'html'],
    coverageDirectory: '../../coverage/packages/itmat-job-executor'
};
