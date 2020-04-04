module.exports = () => ({
    externals: [{
        bcrypt: 'commonjs bcrypt',
        express: 'commonjs express',
        mongodb: 'commonjs mongodb',
        'require_optional': 'commonjs require_optional'
    }],
})