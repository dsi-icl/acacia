const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
    app.use(
        '/file',
        createProxyMiddleware({
            target: process.env.REACT_APP_FILE_SERVICE,
            changeOrigin: true
        })
    );
    app.use(
        '/graphql',
        createProxyMiddleware({
            target: process.env.REACT_APP_GRAPHQL_SERVICE,
            changeOrigin: true
        })
    );
};
