var defaultEnv = {
    browser: true,
    commonjs: true,
    es6: true,
    node: true
};

var defaultPlugins = [
    '@typescript-eslint',
    'jest'
];

var javascriptExtensions = [
    'eslint:recommended'
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
    '@typescript-eslint/camelcase': [
        'off'
    ],
    '@typescript-eslint/interface-name-prefix': [
        'off'
    ],
    '@typescript-eslint/no-this-alias': [
        'off'
    ],
    '@typescript-eslint/no-unused-vars': [
        'warn',
        { 'argsIgnorePattern': '^__unused__' }
    ],
};

console.log('Applying custom ESLint configuration...');

module.exports = {
    env: defaultEnv,
    extends: javascriptExtensions,
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 2018,
        sourceType: 'module'
    },
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
                '**/*.test.ts',
                '**/*.test.tsx',
                '**/*.test.js',
                '**/*.test.jsx',
                '**/test/**/*.ts',
                '**/test/**/*.js'
            ],
            env: Object.assign({}, defaultEnv, {
                'jest/globals': true
            }),
            extends: typescriptExtensions,
            rules: defaultRules
        }
    ]
};