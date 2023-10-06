const jsonRules = {
    indent: [
        'error',
        4,
        {
            SwitchCase: 1,
            ignoredNodes: ['VariableDeclaration[declarations.length=0]']
        }
    ]
};

const javascriptRules = {
    ...jsonRules,
    '@nx/enforce-module-boundaries': [
        'error',
        {
            enforceBuildableLibDependency: true,
            allow: [],
            depConstraints: [
                {
                    sourceTag: '*',
                    onlyDependOnLibsWithTags: ['*']
                }
            ]
        }
    ],
    'react/style-prop-object': 'off',
    'quotes': ['error', 'single'],
    'quote-props': ['error', 'consistent-as-needed'],
    'comma-dangle': ['error', 'never'],
    'no-trailing-spaces': 'error',
    'no-extra-semi': 'error',
    'no-unused-vars': ['error', { args: 'after-used', varsIgnorePattern: '^__unused' }],
    'semi': ['error', 'always']
};

const typescriptRules = {
    ...javascriptRules,
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { args: 'after-used', varsIgnorePattern: '^__unused' }],
    '@typescript-eslint/no-this-alias': 'off',
    '@typescript-eslint/no-explicit-any': 'warn'
};

module.exports = {
    root: true,
    parserOptions: {
        tsconfigRootDir: __dirname,
        project: [
            './tsconfig.eslint.json',
            './packages/*-e2e/tsconfig.json',
            './packages/*/tsconfig.lib.json',
            './packages/*/tsconfig.app.json',
            './packages/*/tsconfig.spec.json'
        ]
    },
    ignorePatterns: ['**/*', '!**/*.json', '!**/*.js', '!**/*.ts', '!scripts', '!tools', '!.vscode'],
    plugins: ['@nx', 'json', 'import'],
    overrides: [
        {
            files: ['*.ts', '*.tsx'],
            extends: ['plugin:@nx/typescript'],
            rules: typescriptRules
        },
        {
            files: ['*.js', '*.jsx'],
            extends: ['plugin:@nx/javascript'],
            rules: javascriptRules
        },
        {
            files: ['*.spec.ts', '*.spec.tsx', '*.spec.js', '*.spec.jsx'],
            env: {
                jest: true
            },
            rules: {}
        },
        {
            files: ['*.json'],
            extends: ['plugin:json/recommended'],
            rules: jsonRules
        }
    ]
};
