module.exports = {
    env: {
        browser: true,
        commonjs: true,
        es6: true,
        node: true,
        'jest/globals': true
    },
    extends: [
        'eslint:recommended',
    ],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        sourceType: 'module'
    },
    plugins: [
        'jest',
        '@typescript-eslint'
    ],
    rules: {
        'indent': [
            'error',
            4
        ],
        'linebreak-style': [
            'error',
            'windows'
        ],
        'quotes': [
            'error',
            'single'
        ],
        'semi': [
            'error',
            'always'
        ]
    },
    overrides: [
        {
            files: [
                '**/*.ts', '**/*.tsx'
            ],
            extends: [
                'eslint:recommended',
                'plugin:@typescript-eslint/eslint-recommended',
                'plugin:@typescript-eslint/recommended'
            ],
        }
    ]
};