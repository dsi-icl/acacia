module.exports = {
    root: true,
    parser: "typescript-eslint-parser",
    plugins: [
        "typescript"
    ],
    env: {
        browser: false,
        node: true,
        es6: true
    },
    parserOptions: {
        "ecmaVersion": 6,
        "sourceType": "module",
        "ecmaFeatures": {
          "modules": true
        }
    },
    rules: {
        'typescript/no-angle-bracket-type-assertion' : 'error',
        'typescript/no-empty-interface': 'error',
        'typescript/no-namespace': 'error',
        'typescript/type-annotation-spacing': 'error',
        'eqeqeq': 'error',
        'no-var': 'error',
        'no-alert': 'error',
        'no-console': 'warn',
        'indent': ['error', 4, { 'SwitchCase': 1 }],
        'quotes': ['error', 'single'],
        'semi': ['error', 'always'],
        'strict': ['warn', 'global'],
        'curly': 'error',
        'array-bracket-spacing': ['error', 'never'],
        'space-infix-ops': 'error',
        'space-in-parens': 'error',
        'space-unary-ops': 'error',
        'no-trailing-spaces': 'error',
        'no-irregular-whitespace': 'error',
        'no-multiple-empty-lines': ['error', { "max": 2, "maxBOF": 0 }],
        'no-unused-vars': ['warn', { 'vars': 'all', 'args': 'after-used', 'argsIgnorePattern': '^__unused__' }],
        'block-spacing': ['error', 'always'],
        'object-curly-spacing': ['error', 'always'],
        'prefer-template': 'warn',
        'no-var': 'error',
        'arrow-body-style': ['error', 'as-needed'],
        'no-case-declarations': 'warn',
        'no-eq-null': 'error',
        'key-spacing': ["error", { "beforeColon": false, "afterColon": true }]
    }
};