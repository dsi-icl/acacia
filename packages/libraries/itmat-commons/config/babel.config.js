module.exports = {
    presets: [
        '@babel/preset-env',
        '@babel/preset-typescript',
        'minify'
    ],
    plugins: [
        'add-module-exports'
    ].concat(process.env.NODE_ENV === 'test' ? [
        'rewire-ts'
    ] : [])
};