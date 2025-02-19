const API_SERVER = 'http://localhost:3333';

module.exports = [
    {
        context: ['/graphql'],
        target: API_SERVER,
        secure: false,
        changeOrigin: true
    },
    {
        context: ['/trpc'],
        target: API_SERVER,
        secure: false,
        changeOrigin: true
    },
    {
        context: ['/webdav'],
        target: API_SERVER,
        secure: false,
        changeOrigin: true,
        autoRewrite: true
    },
    {
        context: ['/file'],
        target: API_SERVER,
        secure: false,
        changeOrigin: true
    },
    {
        context: ['/pun', '/node', '/rnode', '/public', '/rtc', '/jupyter'],
        target: API_SERVER,
        secure: false,
        changeOrigin: true,
        autoRewrite: true,
        ws: true,
        xforward: true
    }
];
