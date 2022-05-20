const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
    app.use(
        '/file',
        createProxyMiddleware({
            target: {
                protocol: 'http',
                host: 'localhost',
                port: 3003
            },
            changeOrigin: true
        })
    );
    app.use(
        '/graphql',
        createProxyMiddleware({
            target: {
                protocol: 'http',
                host: 'localhost',
                port: 3003
            },
            changeOrigin: true
        })
    );
    app.use(
        '/pun',
        createProxyMiddleware({
            target: {
                protocol: 'http',
                host: 'localhost',
                port: 3003
            },
            changeOrigin: true
        })
    );
    app.use(
        '/node',
        createProxyMiddleware({
            target: {
                protocol: 'http',
                host: 'localhost',
                port: 3003
            },
            changeOrigin: true
        })
    );
    app.use(
        '/rnode',
        createProxyMiddleware({
            target: {
                protocol: 'http',
                host: 'localhost',
                port: 3003
            },
            changeOrigin: true
        })
    );
};
