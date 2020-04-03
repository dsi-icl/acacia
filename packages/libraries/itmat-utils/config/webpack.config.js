const path = require('path');

module.exports = {
    mode: 'production',
    entry: './src/index.ts',
    output: {
        path: path.resolve(__dirname, '../dist'),
        filename: 'lib.umd.js',
        libraryTarget: 'umd',
        globalObject: 'this',
        library: 'itmatUtils'
    },
    resolve: {
        extensions: ['.js', '.ts'],
    },
    module: {
        rules: [
            {
                test: /\.(js|ts)$/,
                exclude: /(node_modules)/,
                use: 'babel-loader'
            }
        ]
    },
    devtool: process.NODE_ENV === 'development' ? 'inline-source-map' : 'source-map',
    node: {
        module: 'empty',
        dgram: 'empty',
        dns: 'mock',
        fs: 'empty',
        http2: 'empty',
        net: 'empty',
        tls: 'empty',
        child_process: 'empty',
    },
};