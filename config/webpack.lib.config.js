module.exports = {
    mode: 'production',
    entry: './src/index.ts',
    output: {
        filename: 'lib.umd.js',
        libraryTarget: 'umd',
        globalObject: 'this'
    },
    resolve: {
        mainFields: ['main:src', 'main'],
        extensions: ['.js', '.ts'],
    },
    module: {
        rules: [
            {
                test: /\.(js|ts)$/,
                enforce: 'pre',
                use: [
                    {
                        options: {
                            cache: true,
                            formatter: require.resolve('react-dev-utils/eslintFormatter'),
                            eslintPath: require.resolve('eslint'),
                            resolvePluginsRelativeTo: '..',
                            useEslintrc: true,
                        },
                        loader: require.resolve('eslint-loader'),
                    },
                ],
                include: [process.cwd()]
            },
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