module.exports = {
    extends: 'eslint:recommended',
    parser: '@typescript-eslint/parser',
    plugins: [
        '@typescript-eslint',
        'react',
        'react-hooks'
    ],
    env: {
        es6: true,
        node: true
    },
    ignorePatterns: [
        '**/dist/**',
        '**/build/**'
    ],
    rules: {
        'indent': [
            'error',
            4,
            { 'SwitchCase': 1 }
        ],
        'quotes': [
            'error',
            'single'
        ]
    },
    overrides: [
        {
            files: [
                '*eslint*',
                '*config.js',
                'scripts/*'
            ],
            env: {
                node: true
            }
        },
        {
            files: [
                '**/*.test.ts'
            ],
            env: {
                jest: true
            },
            globals: {
                hasMinio: true,
                minioContainerPort: true
            },
            plugins: [
                'jest',
                '@typescript-eslint'
            ],
            rules: {
                'jest/no-disabled-tests': 'warn',
                'jest/no-focused-tests': 'error',
                'jest/no-identical-title': 'error',
                'jest/prefer-to-have-length': 'warn',
                'jest/valid-expect': 'error'
            }
        }
    ],
};