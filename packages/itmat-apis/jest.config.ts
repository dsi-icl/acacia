/* eslint-disable */
import { readFileSync } from 'fs';

// Reading the SWC compilation config and remove the "exclude"
// for the test files to be compiled by SWC
const { exclude: _, ...swcJestConfig } = JSON.parse(
    readFileSync(`${__dirname}/.lib.swcrc`, 'utf-8')
);
export default {
    displayName: 'itmat-apis',
    preset: '../../jest.preset.js',
    transform: {
        '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
    },
    moduleFileExtensions: ['ts', 'js', 'html'],
    coverageDirectory: '../../coverage/packages/itmat-apis',
    testEnvironment: "<rootDir>/../../test/fixtures/_minioJestEnv",
    transformIgnorePatterns: [
        "node_modules",
        "\\.pnp\\.[^\\\/]+$",
        "test[\\/]fixtures[\\/]_minio"
    ]
};
