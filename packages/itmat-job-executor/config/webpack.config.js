const path = require('path');
const webpack = require('webpack');
const StartServerPlugin = require('start-server-webpack-plugin');

const {
    NODE_ENV = 'production',
} = process.env;

module.exports = {
    mode: NODE_ENV || 'production',
    devtool: NODE_ENV === 'development' ? 'inline-source-map' : 'source-map',
    entry: (NODE_ENV === 'development' ?
        {
            server: ['webpack/hot/poll?1000', './src/index']
        } : {
            core: ['./src/jobExecutorServer']
        }
    ),
    watch: NODE_ENV === 'development' ? true : false,
    target: 'node',
    resolve: {
        extensions: ['.ts', '.mjs', '.js'],
    },
    externals: [{
        bcrypt: 'commonjs bcrypt',
        express: 'commonjs express',
        mongodb: 'commonjs mongodb',
        isobject: 'commonjs isobject',
        require_optional: 'commonjs require_optional'
    }],
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: [
                    'ts-loader',
                ]
            }
        ]
    },
    plugins: (NODE_ENV === 'development' ? [
        new StartServerPlugin('executor.js'),
        new webpack.HotModuleReplacementPlugin()
    ] : []).concat([
        new webpack.NormalModuleReplacementPlugin(/node-pre-gyp/, `${__dirname}/../src/utils/noop`),
        new webpack.IgnorePlugin(new RegExp('^(node-pre-gyp)$')),
        new webpack.NoEmitOnErrorsPlugin(),
        new webpack.DefinePlugin({
            'process.env': {
                BUILD_TARGET: JSON.stringify('server')
            }
        }),
    ]),
    output: {
        path: path.join(__dirname, '../build'),
        filename: 'executor.js',
        library: NODE_ENV === 'development' ? undefined : 'itmat-job-executor',
        libraryTarget: NODE_ENV === 'development' ? undefined : 'umd',
        umdNamedDefine: NODE_ENV === 'development' ? undefined : true
    }
};
