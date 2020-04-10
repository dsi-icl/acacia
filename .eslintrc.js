module.exports = {
    extends: "eslint:recommended",
    env: {
        es6: true,
        node: true
    },
    overrides: [
        {
            files: [
                "**/*.test.ts"
            ],
            env: {
                jest: true
            },
            globals: {
                hasMinio: true,
                minioContainerPort: true
            },
            plugins: ["jest"],
            rules: {
                "jest/no-disabled-tests": "warn",
                "jest/no-focused-tests": "error",
                "jest/no-identical-title": "error",
                "jest/prefer-to-have-length": "warn",
                "jest/valid-expect": "error"
            }
        }
    ],
};