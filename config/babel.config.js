console.log('Applying custom Babel configuration...');

module.exports = {
    presets: [
        [
            '@babel/preset-env',
            {
                targets: {
                    node: 'current',
                },
            }
        ],
        '@babel/preset-typescript'
    ].concat(!['development', 'test'].includes(process.env.NODE_ENV) ? [
        'minify'
    ] : []),
    plugins: [
        'add-module-exports'
    ].concat(process.env.NODE_ENV === 'test' ? [
        'rewire-ts'
    ] : [])
};