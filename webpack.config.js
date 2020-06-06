const path = require('path');

const webConfig = {
    entry: './src/index.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'churchtools-client.js',
        library: 'churchtoolsClient',
        libraryTarget: 'umd'
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

const nodejsConfig = {
    entry: './src/index.js',
    target: 'node',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'churchtools-client-node.js',
        library: 'churchtoolsClient',
        libraryTarget: 'commonjs'
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

module.exports = [ webConfig, nodejsConfig ];
