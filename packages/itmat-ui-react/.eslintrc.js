module.exports = {
    env: {
        browser: true,
        es6: true,
    },
    extends: [
        'eslint:recommended',
        'plugin:react/recommended',
        // 'react-app',
        // 'airbnb',
    ],
    globals: {
        Atomics: 'readonly',
        SharedArrayBuffer: 'readonly',
    },
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaFeatures: {
            jsx: true,
        },
        ecmaVersion: 2018,
        sourceType: 'module',
    },
    plugins: [
        'react',
        '@typescript-eslint',
    ],
    rules: {
        'linebreak-style': ['off'],
        'indent': ['warn', 4],
        'jsx-quotes': ['warn', 'prefer-double'],
        'react/jsx-indent': ['warn', 4],
        'react/jsx-filename-extension': ['warn', { 'extensions': ['.jsx', '.tsx'] }]
    },
    settings: {
        'import/resolver': {
            node: {
                paths: ["src"]
            }
        }
    },
    overrides: [
        {
            files: ["*.d.ts"],
            rules: {
                'spaced-comment': ['off']
            }
        },
        {
            files: ["cypress/**/*.js"],
            env: {
                'cypress/globals': true,
                'jest/globals': true
            },
            plugins: [
                'cypress',
                'jest'
            ],
            rules: {
                'import/no-extraneous-dependencies': ['off'],
            }
        },
        {
            files: ["*.test.{ts,tsx}"],
            env: {
                'jest/globals': true
            },
            plugins: [
                'jest'
            ],
            rules: {
                'import/no-extraneous-dependencies': ['off'],
            }
        }
    ]
};
