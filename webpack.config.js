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
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: [
                            ['@babel/preset-env', {
                                'targets': {
                                    'ie': '11'
                                }
                            }]
                        ]
                    }
                }
            }
        ]
    },
    devtool: 'source-map',
    target: ['web', 'es5']
};

const nodeConfig = {
    entry: './src/index.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'churchtools-client.node.js',
        library: 'churchtoolsClient',
        libraryTarget: 'umd',
        globalObject: 'this'
    },
    mode: 'production',
    module: {
        rules: [
            {
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: [
                            ['@babel/preset-env', {
                                'targets': {
                                    'ie': '11'
                                }
                            }]
                        ]
                    }
                }
            }
        ]
    },
    devtool: 'source-map',
    target: ['node', 'es5']
};

module.exports = [webConfig, nodeConfig];
