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
                // Process any JS outside of the app with Babel.
                // // Unlike the application JS, we only compile the standard ES features.
                // {
                //   test: /\.(js|mjs)$/,
                //   exclude: /@babel(?:\/|\\{1,2})runtime/,
                //   loader: require.resolve('babel-loader'),
                //   options: {
                //     babelrc: false,
                //     configFile: false,
                //     compact: false,
                //     presets: [
                //       [
                //         require.resolve('babel-preset-react-app/dependencies'),
                //         { helpers: true },
                //       ],
                //     ],
                //     cacheDirectory: true,
                //     // See #6846 for context on why cacheCompression is disabled
                //     cacheCompression: false,
                //     // @remove-on-eject-begin
                //     cacheIdentifier: getCacheIdentifier(
                //       isEnvProduction
                //         ? 'production'
                //         : isEnvDevelopment && 'development',
                //       [
                //         'babel-plugin-named-asset-import',
                //         'babel-preset-react-app',
                //         'react-dev-utils',
                //         'react-scripts',
                //       ]
                //     ),
                //     // @remove-on-eject-end
                //     // If an error happens in a package, it's possible to be
                //     // because it was compiled. Thus, we don't want the browser
                //     // debugger to show the original code. Instead, the code
                //     // being evaluated would be much more helpful.
                //     sourceMaps: false,
                //   },
                // },
                {
                  test: /\.css$/,
                  exclude: /\.module.css$/,
                  use: [require.resolve('style-loader'), { options: { modules: true }, loader: require.resolve('css-loader') } , require.resolve('postcss-loader')],
                
                  // Don't consider CSS imports dead code even if the
                  // containing package claims to have no side effects.
                  // Remove this when webpack adds a warning or an error for this.
                  // See https://github.com/webpack/webpack/issues/6571
                  sideEffects: true,
                },
                // Adds support for CSS Modules (https://github.com/css-modules/css-modules)
                // using the extension .module.css
                {
                  test: /\.module.css$/,
                  use: [require.resolve('style-loader'), require.resolve('css-loader'), {
                    loader: require.resolve('postcss-loader'), 
                  options: {
                    // Necessary for external CSS imports to work
                    // https://github.com/facebook/create-react-app/issues/2677
                    ident: 'postcss',
                    plugins: () => [
                      require('postcss-flexbugs-fixes'),
                      require('postcss-preset-env')({
                        autoprefixer: {
                          flexbox: 'no-2009',
                        },
                        stage: 3,
                      })
                    ],
                    sourceMap: false 
                  }
                }
                ] 
                }
              ],
            }
          ]
        }

      };

  on('file:preprocessor', wp({ webpackOptions: webpackconfig }));
}
