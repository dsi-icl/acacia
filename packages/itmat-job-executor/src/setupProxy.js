const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
    app.use(createProxyMiddleware('/graphql', {
        ws: true,
        target: 'http://localhost:3003',
        changeOrigin: true
    }));
};
