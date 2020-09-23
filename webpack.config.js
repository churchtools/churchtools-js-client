const path = require('path');

const webConfig = {
    entry: './src/index.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'churchtools-client.js',
        library: 'churchtoolsClient',
        libraryTarget: 'umd',
        globalObject: 'this'
    },
    mode: 'production',
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /(node_modules)/,
                use: {
                    loader: 'babel-loader'
                }
            }
        ]
    },
    devtool: 'source-map'
};

module.exports = [webConfig];
