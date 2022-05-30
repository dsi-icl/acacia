const { createProxyMiddleware } = require('http-proxy-middleware');

const API_SERVER = 'http://localhost:3003';

module.exports = function (app) {
    app.use(
        '/file',
        createProxyMiddleware({
            target: API_SERVER,
            changeOrigin: true
        })
    );
    app.use(
        '/graphql',
        createProxyMiddleware({
            target: API_SERVER,
            changeOrigin: true
        })
    );
    app.use(
        '/pun',
        createProxyMiddleware({
            target: API_SERVER,
            changeOrigin: true,
            autoRewrite: true,
            ws: true
        })
    );
    app.use(
        '/node',
        createProxyMiddleware({
            target: API_SERVER,
            changeOrigin: true,
            autoRewrite: true,
            ws: true
        })
    );
    app.use(
        '/rnode',
        createProxyMiddleware({
            target: API_SERVER,
            changeOrigin: true,
            autoRewrite: true,
            ws: true
        })
    );
    app.use(
        '/public',
        createProxyMiddleware({
            target: API_SERVER,
            changeOrigin: true,
            autoRewrite: true,
            ws: true
        })
    );
};
