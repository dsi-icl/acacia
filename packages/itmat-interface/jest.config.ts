/* eslint-disable */
export default {
    displayName: 'itmat-interface',
    preset: '../../jest.preset.cjs',
    verbose: true,
    transform: {
        '^.+\\.[tj]s$': ['ts-jest', {
            tsconfig: '<rootDir>/tsconfig.spec.json',
        }]
    },
    moduleFileExtensions: ['ts', 'js', 'html'],
    coverageDirectory: '../../coverage/packages/itmat-interface',
    testEnvironment: "<rootDir>/../../test/fixtures/_minioJestEnv",
    transformIgnorePatterns: [
        "node_modules",
        "\\.pnp\\.[^\\\/]+$",
        "test[\\/]fixtures[\\/]_minio"
    ],
    moduleNameMapper: {
        // Force module uuid to resolve with the CJS entry point, because Jest does not support package.json.exports. See https://github.com/uuidjs/uuid/issues/451
        "uuid": require.resolve('uuid'),
    }
};
