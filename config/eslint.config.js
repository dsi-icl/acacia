var defaultEnv = {
    browser: true,
    commonjs: true,
    es6: true,
    node: true
};

var defaultPlugins = [
    '@typescript-eslint',
    'cypress',
    'flowtype',
    'import',
    'jest',
    'jsx-a11y',
    'react',
    'react-hooks',
];

var javascriptExtensions = [
    'eslint:recommended',
    'react-app'
];

var typescriptExtensions = javascriptExtensions.concat([
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended'
]);

var defaultRules = {
    'indent': [
        'error',
        4,
        { 'SwitchCase': 1 }
    ],
    'no-unused-vars': [
        'warn',
        { 'argsIgnorePattern': '^__unused__' }
    ],
    'quotes': [
        'error',
        'single'
    ],
    'semi': [
        'error',
        'always'
    ],
    'no-explicit-any': [
        'off'
    ],
    '@typescript-eslint/camelcase': [
        'off'
    ],
    '@typescript-eslint/interface-name-prefix': [
        'off'
    ],
    '@typescript-eslint/no-non-null-assertion': [
        'off'
    ],
    '@typescript-eslint/no-this-alias': [
        'off'
    ],
    '@typescript-eslint/no-explicit-any': [
        'off'
    ],
    '@typescript-eslint/no-unused-vars': [
        'warn',
        { 'argsIgnorePattern': '^__unused__' }
    ],
};

module.exports = {
    env: defaultEnv,
    extends: javascriptExtensions,
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 2018,
        sourceType: 'module'
    },
    ignorePatterns: [
        '**/dist/**',
        '**/build/**'
    ],
    plugins: defaultPlugins,
    rules: defaultRules,
    overrides: [
        {
            files: [
                '**/*.ts', '**/*.tsx'
            ],
            globals: {
                Atomics: 'readonly',
                SharedArrayBuffer: 'readonly',
            },
            extends: typescriptExtensions,
            rules: defaultRules
        },
        {
            files: [
                '**/*.test.js',
                '**/*.test.jsx',
                '**/test/**/*.js'
            ],
            env: Object.assign({}, defaultEnv, {
                'jest/globals': true
            }),
            globals: {
                hasMinio: true,
                minioContainerPort: true
            },
            extends: javascriptExtensions,
            rules: defaultRules
        },
        {
            files: [
                '**/*.test.ts',
                '**/*.test.tsx',
                '**/test/**/*.ts'
            ],
            env: Object.assign({}, defaultEnv, {
                'jest/globals': true
            }),
            globals: {
                Atomics: 'readonly',
                SharedArrayBuffer: 'readonly',
                hasMinio: true,
                minioContainerPort: true
            },
            extends: typescriptExtensions,
            rules: defaultRules
        },
        {
            files: [
                '**/cypress/**/*.test.js',
                '**/cypress/**/*.test.jsx',
                '**/cypress/**/test/**/*.js',
                '**/cypress/support/index.js'
            ],
            env: Object.assign({}, defaultEnv, {
                'cypress/globals': true
            }),
            globals: {
                hasMinio: true,
                minioContainerPort: true
            },
            extends: javascriptExtensions,
            rules: defaultRules
        },
        {
            files: [
                '**/cypress/**/*.test.ts',
                '**/cypress/**/*.test.tsx',
                '**/cypress/**/test/**/*.ts'
            ],
            env: Object.assign({}, defaultEnv, {
                'cypress/globals': true
            }),
            globals: {
                Atomics: 'readonly',
                SharedArrayBuffer: 'readonly',
                hasMinio: true,
                minioContainerPort: true
            },
            extends: typescriptExtensions,
            rules: defaultRules
        }
    ]
};