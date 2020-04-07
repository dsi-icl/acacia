if (process.env.npm_execpath.indexOf('yarn') === -1) {
    console.error('Use yarn for installing: https://yarnpkg.com/en/docs/install');
    process.exit(42);
}