const wp = require('@cypress/webpack-preprocessor');

process.env.GENERATE_SOURCEMAP = 'false';
process.env.NODE_ENV = 'development';
process.env.EXTEND_ESLINT = 'true';

module.exports = (on) => {
    const webpackconfig = {
        mode: 'production',
        bail: true,
        module: {
            strictExportPresence: true,
            rules: [
                { parser: { requireEnsure: false } },
                {
                    oneOf: [
                        {
                            test: [/\.bmp$/, /\.gif$/, /\.jpe?g$/, /\.png$/],
                            loader: require.resolve('url-loader')
                        },
                        {
                            test: /\.(js|mjs|jsx|ts|tsx)$/,
                            // include: paths.appSrc,
                            loader: require.resolve('babel-loader'),
                            options: {
                                customize: require.resolve(
                                    'babel-preset-react-app/webpack-overrides'
                                ),
                                babelrc: false,
                                configFile: false,
                                presets: [require.resolve('babel-preset-react-app')],
                                // // Make sure we have a unique cache identifier, erring on the
                                // // side of caution.
                                // // We remove this when the user ejects because the default
                                // // is sane and uses Babel options. Instead of options, we use
                                // // the react-scripts and babel-preset-react-app versions.
                                // cacheIdentifier: getCacheIdentifier(
                                //   isEnvProduction
                                //     ? 'production'
                                //     : isEnvDevelopment && 'development',
                                //   [
                                //     'babel-plugin-named-asset-import',
                                //     'babel-preset-react-app',
                                //     'react-dev-utils',
                                //     'react-scripts',
                                //   ]
                                // ),
                                // @remove-on-eject-end
                                plugins: [
                                    [
                                        require.resolve('babel-plugin-named-asset-import'),
                                        {
                                            loaderMap: {
                                                svg: {
                                                    ReactComponent:
                                '@svgr/webpack?-svgo,+titleProp,+ref![path]',
                                                },
                                            },
                                        },
                                    ],
                                ],
                                cacheDirectory: true,
                                cacheCompression: false,
                            },
                        },
                    ],
                }
            ]
        }

    };

    on('file:preprocessor', wp({ webpackOptions: webpackconfig }));
};
