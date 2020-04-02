module.exports = {
    env: {
        browser: true,
        es6: true,
    },
    extends: [
        'eslint:recommended',
        'plugin:react/recommended',
        'airbnb',
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
        'jsx-quotes': ['warn', 'prefer-double']
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
            rules: {
                'spaced-comment': ['off']
            }
        }
    ]
};
