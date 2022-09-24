const API_SERVER = 'http://localhost:3333';

module.exports = {
    '/graphql': {
        target: API_SERVER,
        secure: false,
        changeOrigin: true
    },
    '/file': {
        target: API_SERVER,
        secure: false,
        changeOrigin: true
    }
};