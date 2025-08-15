console.log('uuid', require.resolve('uuid'));
console.log('graphql-ws 1', require.resolve('graphql-ws'));
console.log('graphql-ws 2', require.resolve('graphql-ws/use/ws'));
/* eslint-disable */
export default {
    displayName: 'itmat-interface',
    preset: '../../jest.preset.cjs',
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
        "graphql-ws/use/ws": require.resolve('graphql-ws/use/ws'),
    },
    setupFilesAfterEnv: ["<rootDir>/test/setupTests.ts"]
};
