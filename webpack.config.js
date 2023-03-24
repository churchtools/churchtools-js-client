const path = require('path');

const generateConfig = (extraTarget, outputFile) => ({
    entry: './src/index.ts',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: outputFile,
        library: 'churchtoolsClient',
        libraryTarget: 'umd',
        globalObject: 'this'
    },
    mode: 'production',
    module: {
        rules: [
            {
                test: /.ts$/,
                use: [{
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
                }]
            }
        ]
    },
    devtool: 'source-map',
    target: [extraTarget, 'es5'],
    resolve: {
        extensions: ['.ts', '.js']
    }
});

module.exports = [generateConfig('web', 'churchtools-client.js'), generateConfig('node', 'churchtools-client.node.js')];
